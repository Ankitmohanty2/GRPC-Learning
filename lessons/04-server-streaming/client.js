const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('04-server-streaming-client');
const env = getEnv();

function createNotificationClient(target = `${env.HOST}:${env.PORT + 3}`) {
  const protoPath = resolveProtoPath('notifications', 'v1', 'notifications.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const notificationsPkg = grpcObject.notifications?.v1;
  return new notificationsPkg.NotificationService(target, grpc.credentials.createInsecure());
}

function runClient(
  target = `${env.HOST}:${env.PORT + 3}`,
  userId = 'user_demo_42',
  cancelAfter = 0,
) {
  return new Promise((resolve, reject) => {
    const client = createNotificationClient(target);
    const notifications = [];

    logger.info({ userId, target }, 'Subscribing to notification stream');
    const stream = client.watchNotifications({ user_id: userId, types: [] });

    stream.on('data', (notification) => {
      logger.info({ id: notification.id, title: notification.title }, 'Stream received notification');
      console.log(`[${notification.type}] ${notification.title}: ${notification.body}`);
      notifications.push(notification);

      if (cancelAfter > 0 && notifications.length >= cancelAfter) {
        console.log(`Client cancelling stream early after ${cancelAfter} messages`);
        stream.cancel();
      }
    });

    stream.on('end', () => {
      logger.info({ totalReceived: notifications.length }, 'Stream ended cleanly by server');
      console.log(`\nStream finished. Total events received: ${notifications.length}\n`);
      client.close();
      resolve(notifications);
    });

    stream.on('error', (err) => {
      if (err.code === grpc.status.CANCELLED) {
        logger.info('Stream cleanly aborted via client cancellation');
        client.close();
        resolve(notifications);
        return;
      }

      logger.error({ code: err.code, details: err.details }, 'Stream error occurred');
      client.close();
      reject(err);
    });
  });
}

if (require.main === module) {
  runClient()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  createNotificationClient,
  runClient,
};
