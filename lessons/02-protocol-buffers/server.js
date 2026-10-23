const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('02-protobuf-server');
const env = getEnv();

function echo(call, callback) {
  const request = call.request;
  logger.info(
    { receivedKeys: Object.keys(request), priority: request.priority },
    'Received Echo request',
  );
  callback(null, request);
}

function startServer(port = env.PORT + 1, host = env.HOST) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('types_demo', 'v1', 'types_demo.proto');
    const { grpcObject, packageDefinition } = loadProtoFile(protoPath);

    const typesDemoPkg = grpcObject.types_demo?.v1;
    if (!typesDemoPkg?.TypesDemoService?.service) {
      throw new Error('TypesDemoService not found in types_demo.proto');
    }

    const server = new grpc.Server();
    server.addService(typesDemoPkg.TypesDemoService.service, { echo });

    const reflection = new ReflectionService(packageDefinition);
    reflection.addToServer(server);

    const address = `${host}:${port}`;
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        logger.error({ err, address }, 'Failed to bind protobuf demo server');
        return reject(err);
      }
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC Protobuf Demo server running');
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
