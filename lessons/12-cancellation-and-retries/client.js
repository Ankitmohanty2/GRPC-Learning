const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { executeWithRetry } = require('../../src/interceptors/retry');
const { statusName } = require('../../src/common/errors');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('12-retries-client');
const env = getEnv();

function createGreeterClient(target = `${env.HOST}:${env.PORT + 12}`) {
  const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const helloworldPkg = grpcObject.helloworld;
  return new helloworldPkg.Greeter(target, grpc.credentials.createInsecure());
}

function callWithRetry(target = `${env.HOST}:${env.PORT + 12}`, name = 'flaky_user') {
  const client = createGreeterClient(target);

  return executeWithRetry(
    () =>
      new Promise((resolve, reject) => {
        logger.info({ name }, 'Attempting gRPC SayHello call');
        client.sayHello({ name }, (err, res) => {
          if (err) return reject(err);
          resolve(res);
        });
      }),
    {
      maxRetries: 4,
      initialBackoffMs: 50,
      maxBackoffMs: 500,
    },
  ).finally(() => {
    client.close();
  });
}

function callAndCancel(target = `${env.HOST}:${env.PORT + 12}`) {
  return new Promise((resolve) => {
    const client = createGreeterClient(target);
    logger.info('Calling long task, will cancel after 100ms');

    const call = client.sayHello({ name: 'long_task' }, (err) => {
      client.close();
      if (err) {
        logger.info({ code: statusName(err.code), details: err.details }, 'Call terminated after cancellation');
      }
      resolve();
    });

    setTimeout(() => {
      console.log('Client calling call.cancel()');
      call.cancel();
    }, 100);
  });
}

if (require.main === module) {
  (async () => {
    console.log('\n--- 1. Testing Resilient Call with Exponential Backoff ---');
    const res = await callWithRetry();
    console.log(`Result: ${res.message}`);

    console.log('\n--- 2. Testing Client-Side Call Cancellation ---');
    await callAndCancel();
    console.log('Cancellation test completed\n');
  })();
}

module.exports = {
  createGreeterClient,
  callWithRetry,
  callAndCancel,
};
