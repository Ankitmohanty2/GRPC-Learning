const fs = require('node:fs');
const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('11-tls-client');
const env = getEnv();

function createTlsClient(target = `127.0.0.1:${env.PORT + 11}`, useMtls = false) {
  const certDir = path.join(__dirname, 'certs');
  const rootCert = fs.readFileSync(path.join(certDir, 'ca.crt'));

  let channelCreds;

  if (useMtls) {
    const clientCert = fs.readFileSync(path.join(certDir, 'client.crt'));
    const clientKey = fs.readFileSync(path.join(certDir, 'client.key'));
    channelCreds = grpc.credentials.createSsl(rootCert, clientKey, clientCert);
  } else {
    channelCreds = grpc.credentials.createSsl(rootCert);
  }

  const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const helloworldPkg = grpcObject.helloworld;

  return new helloworldPkg.Greeter(target, channelCreds, {
    'grpc.ssl_target_name_override': 'localhost',
  });
}

function runSecureCall(
  target = `127.0.0.1:${env.PORT + 11}`,
  useMtls = false,
  name = 'SecureAlice',
) {
  return new Promise((resolve, reject) => {
    const client = createTlsClient(target, useMtls);
    logger.info({ target, useMtls }, 'Sending SayHello over encrypted TLS/mTLS channel');

    client.sayHello({ name }, (err, res) => {
      client.close();
      if (err) {
        logger.error({ code: err.code, details: err.details }, 'Secure RPC call failed');
        return reject(err);
      }
      logger.info({ message: res.message }, 'Secure RPC response received successfully');
      console.log(`\nEncrypted TLS Response: ${res.message}\n`);
      resolve(res);
    });
  });
}

if (require.main === module) {
  runSecureCall()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  createTlsClient,
  runSecureCall,
};
