const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { statusName } = require('../../src/common/errors');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('07-deadlines-client');
const env = getEnv();

function createGreeterClient(target = `${env.HOST}:${env.PORT + 7}`) {
  const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const helloworldPkg = grpcObject.helloworld;
  return new helloworldPkg.Greeter(target, grpc.credentials.createInsecure());
}

function callWithTimeout(target = `${env.HOST}:${env.PORT + 7}`, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const client = createGreeterClient(target);
    const deadline = new Date(Date.now() + timeoutMs);

    logger.info({ timeoutMs, deadline: deadline.toISOString() }, 'Calling SayHello with deadline');

    client.sayHello({ name: `DeadlineUser_${timeoutMs}ms` }, { deadline }, (err, res) => {
      client.close();
      if (err) {
        logger.warn({ code: statusName(err.code), details: err.details }, 'Call failed with status');
        return reject(err);
      }
      logger.info({ message: res.message }, 'Call succeeded within deadline');
      resolve(res);
    });
  });
}

if (require.main === module) {
  console.log('\n--- 1. Testing call with sufficient deadline (1000ms) ---');
  callWithTimeout(undefined, 1000)
    .then((res) => console.log('Succeeded:', res.message))
    .then(() => {
      console.log('\n--- 2. Testing call with tight deadline (50ms) ---');
      return callWithTimeout(undefined, 50);
    })
    .catch((err) => {
      console.log(`Caught expected timeout: [${statusName(err.code)}] ${err.details}\n`);
    });
}

module.exports = {
  createGreeterClient,
  callWithTimeout,
};
