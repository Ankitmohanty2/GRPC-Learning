const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { statusName } = require('../../src/common/errors');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('03-unary-client');
const env = getEnv();

function createUserServiceClient(target = `${env.HOST}:${env.PORT + 2}`) {
  const protoPath = resolveProtoPath('users', 'v1', 'users.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const usersPkg = grpcObject.users?.v1;
  return new usersPkg.UserService(target, grpc.credentials.createInsecure());
}

function runClient(target = `${env.HOST}:${env.PORT + 2}`) {
  return new Promise((resolve, reject) => {
    const client = createUserServiceClient(target);

    console.log('\n--- 1. Testing CreateUser ---');
    const newEmail = `charlie_${Date.now()}@example.com`;
    client.createUser({ name: 'Charlie Bucket', email: newEmail }, (err, res) => {
      if (err) {
        logger.error({ code: statusName(err.code), details: err.details }, 'CreateUser failed');
        client.close();
        return reject(err);
      }
      console.log(`Created user: ${res.user.name} (${res.user.id})`);

      console.log('\n--- 2. Testing GetUser ---');
      client.getUser({ id: res.user.id }, (err2, res2) => {
        if (err2) {
          client.close();
          return reject(err2);
        }
        console.log(`Retrieved user: ${res2.user.email} (Status: ${res2.user.status})`);

        console.log('\n--- 3. Testing GetUser (Negative: NOT_FOUND) ---');
        client.getUser({ id: 'non_existent_id' }, (err3) => {
          if (err3) {
            console.log(`Expected error caught: [${statusName(err3.code)}] ${err3.details}`);
          }

          console.log('\n--- 4. Testing ListUsers (Pagination) ---');
          client.listUsers({ pagination: { page_size: 2 } }, (err4, res4) => {
            if (err4) {
              client.close();
              return reject(err4);
            }
            console.log(
              `ListUsers returned ${res4.users?.length} users (Total: ${res4.pagination?.total_count})`,
            );
            console.log(`   Next Page Token: "${res4.pagination?.next_page_token}"\n`);
            client.close();
            resolve();
          });
        });
      });
    });
  });
}

if (require.main === module) {
  runClient()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  createUserServiceClient,
  runClient,
};
