const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('01-helloworld-client');
const env = getEnv();

function runClient(target = `${env.HOST}:${env.PORT}`, name = 'Alice') {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
    const { grpcObject } = loadProtoFile(protoPath);

    const helloworldPkg = grpcObject.helloworld;
    const GreeterClient = helloworldPkg.Greeter;

    const client = new GreeterClient(target, grpc.credentials.createInsecure());

    logger.info({ target, name }, 'Sending SayHello request');

    client.sayHello({ name }, (err, response) => {
      if (err) {
        logger.error({ code: err.code, details: err.details }, 'gRPC SayHello failed');
        client.close();
        return reject(err);
      }

      logger.info({ message: response.message }, 'Received response from server');
      console.log(`\n🎉 Server says: ${response.message}\n`);
      client.close();
      resolve(response);
    });
  });
}

if (require.main === module) {
  const nameArg = process.argv[2] || 'Alice';
  runClient(undefined, nameArg)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  runClient,
};
