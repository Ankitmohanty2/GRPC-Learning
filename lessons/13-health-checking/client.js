const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('13-health-client');
const env = getEnv();

function createHealthClient(target = `${env.HOST}:${env.PORT + 13}`) {
  const protoPath = resolveProtoPath('grpc', 'health', 'v1', 'health.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const healthPkg = grpcObject.grpc?.health?.v1;
  return new healthPkg.Health(target, grpc.credentials.createInsecure());
}

function checkHealth(target = `${env.HOST}:${env.PORT + 13}`, service = 'helloworld.Greeter') {
  return new Promise((resolve, reject) => {
    const client = createHealthClient(target);
    logger.info({ service, target }, 'Probing gRPC Health status');

    client.check({ service }, (err, res) => {
      client.close();
      if (err) {
        logger.error({ code: err.code, details: err.details }, 'Health check failed');
        return reject(err);
      }
      logger.info({ service, status: res.status }, 'Health probe received status');
      resolve(res.status);
    });
  });
}

if (require.main === module) {
  (async () => {
    console.log('\n--- 1. Probing Overall Server Health ---');
    const overall = await checkHealth(undefined, '');
    console.log(`Server Health: ${overall}`);

    console.log('\n--- 2. Probing Greeter Service Health ---');
    const greeter = await checkHealth(undefined, 'helloworld.Greeter');
    console.log(`Greeter Service Health: ${greeter}\n`);
  })();
}

module.exports = {
  createHealthClient,
  checkHealth,
};
