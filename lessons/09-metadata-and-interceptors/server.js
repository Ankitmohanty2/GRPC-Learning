const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('09-metadata-server');
const env = getEnv();

function sayHello(call, callback) {
  const startTime = performance.now();
  const correlationId = call.metadata.get('x-correlation-id')[0]?.toString() || 'none';
  const clientApp = call.metadata.get('x-client-app')[0]?.toString() || 'unknown';

  logger.info({ correlationId, clientApp, peer: call.getPeer() }, 'Received metadata in SayHello');

  const name = call.request.name || 'World';

  const trailers = new grpc.Metadata();
  const executionMs = (performance.now() - startTime).toFixed(2);
  trailers.set('x-server-execution-time-ms', executionMs);
  trailers.set('x-correlation-id', correlationId);

  callback(null, { message: `Hello, ${name}!` }, trailers);
}

function startServer(port = env.PORT + 9, host = env.HOST) {
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
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC Metadata Demo server running');
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
