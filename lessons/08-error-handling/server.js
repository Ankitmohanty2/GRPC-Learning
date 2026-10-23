const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('08-errors-server');
const env = getEnv();

function sayHello(call, callback) {
  const name = call.request.name || '';

  if (name.length < 2) {
    const errorMetadata = new grpc.Metadata();
    errorMetadata.set('x-error-domain', 'validation');
    errorMetadata.set('x-field-name', 'name');
    errorMetadata.set('x-constraint', 'min_length_2');

    logger.warn({ name }, 'Rejecting name shorter than 2 chars');
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      details: 'Field "name" must be at least 2 characters',
      metadata: errorMetadata,
    });
  }

  if (name.toLowerCase() === 'spammer') {
    const errorMetadata = new grpc.Metadata();
    errorMetadata.set('retry-after-ms', '5000');

    logger.warn('Rate limit exceeded for user');
    return callback({
      code: grpc.status.RESOURCE_EXHAUSTED,
      details: 'Rate limit quota exceeded. Please back off.',
      metadata: errorMetadata,
    });
  }

  if (name.toLowerCase() === 'trigger_db_crash') {
    try {
      throw new Error('FATAL: relation "production_credentials" does not exist at postgres.internal:5432');
    } catch (rawError) {
      logger.error({ rawError: rawError.message }, 'Internal database failure caught');
      return callback({
        code: grpc.status.INTERNAL,
        details: 'An internal error occurred. Please contact support with request ID.',
      });
    }
  }

  callback(null, { message: `Hello, ${name}!` });
}

function startServer(port = env.PORT + 8, host = env.HOST) {
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
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC Error Handling Demo server running');
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
