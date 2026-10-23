const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { generateToken, createAuthMetadata } = require('../../src/interceptors/auth');
const { statusName } = require('../../src/common/errors');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('10-auth-client');
const env = getEnv();

function createGreeterClient(target = `${env.HOST}:${env.PORT + 10}`) {
  const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const helloworldPkg = grpcObject.helloworld;
  return new helloworldPkg.Greeter(target, grpc.credentials.createInsecure());
}

function makeAuthenticatedCall(
  target = `${env.HOST}:${env.PORT + 10}`,
  token,
  action = 'standard_greeting',
) {
  return new Promise((resolve, reject) => {
    const client = createGreeterClient(target);
    const metadata = token ? createAuthMetadata(token) : new grpc.Metadata();

    logger.info({ hasToken: !!token, action }, 'Making gRPC call');

    client.sayHello({ name: action }, metadata, (err, res) => {
      client.close();
      if (err) {
        logger.warn({ code: statusName(err.code), details: err.details }, 'Call failed with status');
        return reject(err);
      }
      logger.info({ message: res.message }, 'Call succeeded');
      resolve(res);
    });
  });
}

if (require.main === module) {
  (async () => {
    const regularUser = { userId: 'usr_reg_1', role: 'user', email: 'user@example.com' };
    const adminUser = { userId: 'usr_adm_99', role: 'admin', email: 'admin@example.com' };

    const regularToken = generateToken(regularUser);
    const adminToken = generateToken(adminUser);

    console.log('\n--- 1. Testing Unauthenticated Request (No Token) ---');
    try {
      await makeAuthenticatedCall(undefined, undefined);
    } catch (err) {
      console.log(`Caught expected error: [${statusName(err.code)}] ${err.details}`);
    }

    console.log('\n--- 2. Testing Regular User Token for Standard Request ---');
    const res2 = await makeAuthenticatedCall(undefined, regularToken, 'standard_greeting');
    console.log(`Succeeded: ${res2.message}`);

    console.log('\n--- 3. Testing Regular User Token for Admin-Only Action ---');
    try {
      await makeAuthenticatedCall(undefined, regularToken, 'admin_only_purge');
    } catch (err) {
      console.log(`Caught expected error: [${statusName(err.code)}] ${err.details}`);
    }

    console.log('\n--- 4. Testing Admin User Token for Admin-Only Action ---');
    const res4 = await makeAuthenticatedCall(undefined, adminToken, 'admin_only_purge');
    console.log(`Succeeded: ${res4.message}\n`);
  })();
}

module.exports = {
  createGreeterClient,
  makeAuthenticatedCall,
};
