const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { statusName } = require('../../src/common/errors');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('08-errors-client');
const env = getEnv();

function createGreeterClient(target = `${env.HOST}:${env.PORT + 8}`) {
  const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const helloworldPkg = grpcObject.helloworld;
  return new helloworldPkg.Greeter(target, grpc.credentials.createInsecure());
}

function testErrorScenario(target = `${env.HOST}:${env.PORT + 8}`, name) {
  return new Promise((resolve) => {
    const client = createGreeterClient(target);

    client.sayHello({ name }, (err, res) => {
      client.close();

      if (err) {
        const metaObj = {};
        if (err.metadata) {
          const map = err.metadata.getMap();
          for (const [k, v] of Object.entries(map)) {
            metaObj[k] = String(v);
          }
        }

        logger.info({ code: statusName(err.code), details: err.details, meta: metaObj }, 'Error received');
        return resolve({
          status: statusName(err.code),
          code: err.code,
          details: err.details,
          metadata: metaObj,
        });
      }

      resolve({
        status: 'OK',
        code: grpc.status.OK,
        details: res.message,
      });
    });
  });
}

if (require.main === module) {
  (async () => {
    console.log('\n--- 1. Validation Error with Metadata ---');
    const res1 = await testErrorScenario(undefined, 'A');
    console.log(`[${res1.status}] ${res1.details}`);
    console.log('Metadata:', res1.metadata);

    console.log('\n--- 2. Rate Limit Error with Retry-After ---');
    const res2 = await testErrorScenario(undefined, 'spammer');
    console.log(`[${res2.status}] ${res2.details}`);
    console.log('Retry after:', res2.metadata?.['retry-after-ms'], 'ms');

    console.log('\n--- 3. Internal Error Sanitization ---');
    const res3 = await testErrorScenario(undefined, 'trigger_db_crash');
    console.log(`[${res3.status}] ${res3.details}`);
    console.log(
      'Raw DB credentials leaked?:',
      res3.details.includes('postgres') ? 'LEAKED' : 'SECURE (Sanitized)',
    );
  })();
}

module.exports = {
  createGreeterClient,
  testErrorScenario,
};
