const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('01-helloworld-server');
const env = getEnv();

function sayHello(call, callback) {
  const name = call.request.name || 'World';
  logger.info({ name, peer: call.getPeer() }, 'Received SayHello request');
  callback(null, { message: `Hello, ${name}!` });
}

function startServer(port = env.PORT, host = env.HOST) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
    const { grpcObject, packageDefinition } = loadProtoFile(protoPath);

    const helloworldPkg = grpcObject.helloworld;
    if (!helloworldPkg?.Greeter?.service) {
      throw new Error('Greeter service not found in helloworld.proto');
    }

    const server = new grpc.Server();
    server.addService(helloworldPkg.Greeter.service, { sayHello });

    const reflection = new ReflectionService(packageDefinition);
    reflection.addToServer(server);

    const address = `${host}:${port}`;
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        logger.error({ err, address }, 'Failed to bind gRPC server');
        return reject(err);
      }
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC Hello World server running');
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
