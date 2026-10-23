const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createGrpcError } = require('../../src/common/errors');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('04-server-streaming-server');
const env = getEnv();

function watchNotifications(call) {
  const { user_id, types } = call.request;
  logger.info({ user_id, types }, 'Client subscribed to notifications');

  if (!user_id) {
    logger.warn('Missing user_id in subscription request');
    call.emit('error', createGrpcError(grpc.status.INVALID_ARGUMENT, 'user_id is required'));
    return;
  }

  let count = 0;
  const maxEvents = 5;

  const timer = setInterval(() => {
    if (call.cancelled) {
      logger.info({ user_id }, 'Stream was cancelled by client, clearing interval');
      clearInterval(timer);
      return;
    }

    count++;
    const notification = {
      id: `notif_${count}_${Date.now()}`,
      title: `System Alert #${count}`,
      body: `Notification payload #${count} dispatched for user ${user_id}`,
      type: count % 2 === 0 ? 'NOTIFICATION_TYPE_WARNING' : 'NOTIFICATION_TYPE_INFO',
      timestamp: {
        seconds: Math.floor(Date.now() / 1000),
        nanos: 0,
      },
    };

    logger.debug({ notificationId: notification.id }, 'Writing notification to stream');

    const canContinue = call.write(notification);
    if (!canContinue) {
      logger.warn('Stream backpressure detected — waiting for drain');
      call.once('drain', () => {
        logger.info('Stream drained — resuming writes');
      });
    }

    if (count >= maxEvents) {
      clearInterval(timer);
      logger.info({ user_id, totalSent: count }, 'Finished sending stream, calling end()');
      call.end();
    }
  }, 100);

  call.on('cancelled', () => {
    logger.info({ user_id }, 'Client aborted stream');
    clearInterval(timer);
  });
}

function startServer(port = env.PORT + 3, host = env.HOST) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('notifications', 'v1', 'notifications.proto');
    const { grpcObject, packageDefinition } = loadProtoFile(protoPath);

    const notificationsPkg = grpcObject.notifications?.v1;
    if (!notificationsPkg?.NotificationService?.service) {
      throw new Error('NotificationService not found in notifications.proto');
    }

    const server = new grpc.Server();
    server.addService(notificationsPkg.NotificationService.service, {
      watchNotifications,
    });

    const reflection = new ReflectionService(packageDefinition);
    reflection.addToServer(server);

    const address = `${host}:${port}`;
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        logger.error({ err, address }, 'Failed to bind NotificationService server');
        return reject(err);
      }
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC NotificationService Streaming server running');
      resolve({ server, port: boundPort });
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err }, 'Server fatal error');
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
