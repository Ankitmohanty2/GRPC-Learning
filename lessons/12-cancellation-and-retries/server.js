const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createGrpcError } = require('../../src/common/errors');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('12-retries-server');
const env = getEnv();

let flakyAttempts = 0;

function sayHello(call, callback) {
  flakyAttempts++;
  const name = call.request.name || 'RetryUser';

  if (name.startsWith('flaky_') && flakyAttempts < 3) {
    logger.warn({ flakyAttempts, name }, 'Simulating transient UNAVAILABLE network/node failure');
    return callback(
      createGrpcError(grpc.status.UNAVAILABLE, `Transient outage (attempt ${flakyAttempts}/3)`),
    );
  }

  if (name === 'long_task') {
    logger.info('Starting long background task');
    const timer = setTimeout(() => {
      if (!call.cancelled) {
        callback(null, { message: 'Task finished' });
      }
    }, 2000);

    call.on('cancelled', () => {
      logger.warn('Client cancelled call — aborting timer');
      clearTimeout(timer);
    });
    return;
  }

  logger.info({ flakyAttempts, name }, 'Flaky service recovered — returning successful response');
  callback(null, { message: `Success on attempt #${flakyAttempts}, ${name}!` });
}

function resetFlakyAttempts() {
  flakyAttempts = 0;
}

function startServer(port = env.PORT + 12, host = env.HOST) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
    const { grpcObject, packageDefinition } = loadProtoFile(protoPath);

    const helloworldPkg = grpcObject.helloworld;
    const server = new grpc.Server();
    server.addService(helloworldPkg.Greeter.service, { sayHello });

    const reflection = new ReflectionService(packageDefinition);
    reflection.addToServer(server);

    const address = `${host}:${port}`;
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC Cancellation & Retries server running');
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
  resetFlakyAttempts,
};
