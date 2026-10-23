const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('07-deadlines-server');
const env = getEnv();

function sayHello(call, callback) {
  const name = call.request.name || 'World';
  const deadline = call.getDeadline();
  const now = Date.now();
  const remainingMs = typeof deadline === 'number' ? deadline - now : Infinity;

  logger.info({ name, remainingMs }, 'Received SayHello with deadline');

  const simulatedDelay = 300;

  const timer = setTimeout(() => {
    if (call.cancelled) {
      logger.warn('Call cancelled by client before handler finished');
      return;
    }
    callback(null, { message: `Hello after ${simulatedDelay}ms, ${name}!` });
  }, simulatedDelay);

  call.on('cancelled', () => {
    logger.warn('Client deadline exceeded or cancelled — aborting background work');
    clearTimeout(timer);
  });
}

function startServer(port = env.PORT + 7, host = env.HOST) {
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
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC Deadlines Demo server running');
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
