const fs = require('node:fs');
const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('11-tls-server');
const env = getEnv();

function sayHello(call, callback) {
  const name = call.request.name || 'SecureUser';
  logger.info({ name, peer: call.getPeer() }, 'TLS Handshake succeeded — serving request securely');
  callback(null, { message: `Secure TLS Hello, ${name}!` });
}

function startSecureServer(
  port = env.PORT + 11,
  host = '127.0.0.1',
  requireClientCert = false,
) {
  return new Promise((resolve, reject) => {
    const certDir = path.join(__dirname, 'certs');
    const rootCert = fs.readFileSync(path.join(certDir, 'ca.crt'));
    const serverCert = fs.readFileSync(path.join(certDir, 'server.crt'));
    const serverKey = fs.readFileSync(path.join(certDir, 'server.key'));

    const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
    const { grpcObject, packageDefinition } = loadProtoFile(protoPath);
    const helloworldPkg = grpcObject.helloworld;

    const server = new grpc.Server();
    server.addService(helloworldPkg.Greeter.service, { sayHello });

    const reflection = new ReflectionService(packageDefinition);
    reflection.addToServer(server);

    const serverCreds = grpc.ServerCredentials.createSsl(
      rootCert,
      [{ cert_chain: serverCert, private_key: serverKey }],
      requireClientCert,
    );

    const address = `${host}:${port}`;
    server.bindAsync(address, serverCreds, (err, boundPort) => {
      if (err) {
        logger.error({ err, address }, 'Failed to bind secure gRPC server');
        return reject(err);
      }
      logger.info({ address: `${host}:${boundPort}`, requireClientCert }, 'gRPC TLS/mTLS server running');
      resolve({ server, port: boundPort });
    });
  });
}

if (require.main === module) {
  startSecureServer().catch((err) => {
    logger.error({ err }, 'Server fatal error');
    process.exit(1);
  });
}

module.exports = {
  startSecureServer,
};
