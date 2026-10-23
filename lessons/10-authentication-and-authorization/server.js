const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createGrpcError } = require('../../src/common/errors');
const { verifyAuthMetadata } = require('../../src/interceptors/auth');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('10-auth-server');
const env = getEnv();

function sayHello(call, callback) {
  let user;
  try {
    user = verifyAuthMetadata(call.metadata);
  } catch (err) {
    logger.warn({ err: err.details }, 'Authentication failed');
    return callback(err);
  }

  logger.info({ userId: user.userId, role: user.role }, 'User authenticated');

  const requestedAction = call.request.name || '';
  if (requestedAction === 'admin_only_purge' && user.role !== 'admin') {
    logger.warn({ userId: user.userId, role: user.role }, 'Authorization denied: admin role required');
    return callback(
      createGrpcError(grpc.status.PERMISSION_DENIED, 'Insufficient permissions: admin role required'),
    );
  }

  callback(null, {
    message: `Hello ${user.email}! (Role: ${user.role}, UserID: ${user.userId})`,
  });
}

function startServer(port = env.PORT + 10, host = env.HOST) {
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
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC Auth Demo server running');
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
