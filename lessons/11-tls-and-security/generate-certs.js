const fs = require('node:fs');
const path = require('node:path');
const selfsigned = require('selfsigned');

async function generateCertificates() {
  const pems = await selfsigned.generate(
    [
      { name: 'commonName', value: 'localhost' },
      { name: 'organizationName', value: 'gRPC Learning Lab' },
    ],
    {
      keySize: 2048,
      days: 365,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
          ],
        },
      ],
    },
  );

  return {
    caCert: Buffer.from(pems.cert),
    serverCert: Buffer.from(pems.cert),
    serverKey: Buffer.from(pems.private),
    clientCert: Buffer.from(pems.cert),
    clientKey: Buffer.from(pems.private),
  };
}

async function writeCertsToDisk(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const bundle = await generateCertificates();
  fs.writeFileSync(path.join(dirPath, 'ca.crt'), bundle.caCert);
  fs.writeFileSync(path.join(dirPath, 'server.crt'), bundle.serverCert);
  fs.writeFileSync(path.join(dirPath, 'server.key'), bundle.serverKey);
  fs.writeFileSync(path.join(dirPath, 'client.crt'), bundle.clientCert);
  fs.writeFileSync(path.join(dirPath, 'client.key'), bundle.clientKey);

  console.log(`Generated X.509 TLS and mTLS certificates in ${dirPath}`);
  return bundle;
}

if (require.main === module) {
  const certDir = path.join(__dirname, 'certs');
  writeCertsToDisk(certDir).catch(console.error);
}

module.exports = {
  generateCertificates,
  writeCertsToDisk,
};
