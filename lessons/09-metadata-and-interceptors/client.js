const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { clientLoggingInterceptor } = require('../../src/interceptors/logging');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('09-metadata-client');
const env = getEnv();

function createGreeterClientWithInterceptor(target = `${env.HOST}:${env.PORT + 9}`) {
  const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const helloworldPkg = grpcObject.helloworld;

  return new helloworldPkg.Greeter(target, grpc.credentials.createInsecure(), {
    interceptors: [clientLoggingInterceptor],
  });
}

function runClientWithMetadata(
  target = `${env.HOST}:${env.PORT + 9}`,
  correlationId = `custom-corr-${Date.now()}`,
) {
  return new Promise((resolve, reject) => {
    const client = createGreeterClientWithInterceptor(target);

    const metadata = new grpc.Metadata();
    metadata.set('x-correlation-id', correlationId);
    metadata.set('x-client-app', 'NodeFrontendService');

    let responseTrailers = {};
    let responseMessage = '';

    logger.info({ correlationId }, 'Executing gRPC call with metadata and client interceptor');

    const call = client.sayHello(
      { name: 'InterceptorUser' },
      metadata,
      (err, res) => {
        if (err) {
          logger.error({ err }, 'Call failed');
          client.close();
          return reject(err);
        }
        responseMessage = res.message;
      },
    );

    call.on('status', (status) => {
      if (status.metadata) {
        const map = status.metadata.getMap();
        for (const [k, v] of Object.entries(map)) {
          responseTrailers[k] = String(v);
        }
      }
      client.close();
      console.log(`\n🎉 Server Response: ${responseMessage}`);
      console.log('📦 Returned Trailers:', responseTrailers, '\n');
      resolve({ message: responseMessage, trailers: responseTrailers });
    });
  });
}

if (require.main === module) {
  runClientWithMetadata()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  createGreeterClientWithInterceptor,
  runClientWithMetadata,
};
