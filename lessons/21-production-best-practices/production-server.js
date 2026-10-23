const grpc = require('@grpc/grpc-js');
const { registerHealthService } = require('../../src/servers/health');
const { createLogger } = require('../../src/config/logger');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { ReflectionService } = require('@grpc/reflection');

const logger = createLogger('production-grpc-server');

const CHANNEL_OPTIONS = {
  'grpc.keepalive_time_ms': 30000,
  'grpc.keepalive_timeout_ms': 10000,
  'grpc.keepalive_permit_without_calls': 1,
  'grpc.http2.min_ping_interval_without_data_ms': 10000,
  'grpc.max_receive_message_length': 1024 * 1024 * 4,
  'grpc.max_send_message_length': 1024 * 1024 * 4,
};

async function startProductionServer(port = 50051, host = '0.0.0.0') {
  const server = new grpc.Server(CHANNEL_OPTIONS);

  const proto = loadProtoFile(resolveProtoPath('helloworld', 'helloworld.proto')).grpcObject;

  server.addService(proto.helloworld.Greeter.service, {
    sayHello: (call, callback) => {
      logger.info({ name: call.request.name }, 'Processing production RPC request');
      callback(null, { message: `Hello, ${call.request.name || 'World'}!` });
    },
  });

  registerHealthService(server);

  const reflection = new ReflectionService(proto);
  reflection.addToServer(server);

  const boundPort = await new Promise((resolve, reject) => {
    server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err, p) => {
      if (err) return reject(err);
      resolve(p);
    });
  });

  logger.info({ host, port: boundPort }, 'Production gRPC Server listening');

  let isShuttingDown = false;
  const gracefulShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.warn({ signal }, 'Received termination signal, initiating graceful drain');

    const forceKillTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out (5s), forcing immediate shutdown');
      server.forceShutdown();
      process.exit(1);
    }, 5000);

    server.tryShutdown((err) => {
      clearTimeout(forceKillTimer);
      if (err) {
        logger.error({ err }, 'Error during graceful shutdown, forcing stop');
        server.forceShutdown();
        process.exit(1);
      }
      logger.info('gRPC server terminated cleanly without connection drop');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  return { server, port: boundPort };
}

if (require.main === module) {
  startProductionServer().catch((err) => {
    logger.fatal({ err }, 'Failed to bootstrap production server');
    process.exit(1);
  });
}

module.exports = {
  startProductionServer,
  CHANNEL_OPTIONS,
};
