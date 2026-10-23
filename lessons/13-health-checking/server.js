const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { HealthImplementation } = require('../../src/servers/health');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('13-health-server');
const env = getEnv();

const healthService = new HealthImplementation();

function startHealthServer(port = env.PORT + 13, host = env.HOST) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
    const { grpcObject, packageDefinition } = loadProtoFile(protoPath);

    const helloworldPkg = grpcObject.helloworld;
    const server = new grpc.Server();

    server.addService(helloworldPkg.Greeter.service, {
      sayHello: (call, cb) => cb(null, { message: `Hello ${call.request.name || 'World'}` }),
    });

    healthService.addToServer(server);
    healthService.setStatus('helloworld.Greeter', 'SERVING');

    const reflection = new ReflectionService(packageDefinition);
    reflection.addToServer(server);

    const address = `${host}:${port}`;
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC Health Check server running');
      resolve({ server, port: boundPort });
    });
  });
}

if (require.main === module) {
  startHealthServer().catch((err) => {
    logger.error({ err }, 'Server fatal error');
    process.exit(1);
  });
}

module.exports = {
  healthService,
  startHealthServer,
};
