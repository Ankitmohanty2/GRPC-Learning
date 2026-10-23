const grpc = require('@grpc/grpc-js');
const { startSecureServer } = require('../lessons/11-tls-and-security/server');
const { runSecureCall } = require('../lessons/11-tls-and-security/client');
const { loadProtoFile, resolveProtoPath } = require('../src/common/proto-loader');

describe('Lesson 11: TLS and Security', () => {
  let serverInstance;
  let boundPort;

  beforeAll(async () => {
    const result = await startSecureServer(0, '127.0.0.1', true);
    serverInstance = result.server;
    boundPort = result.port;
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      serverInstance.tryShutdown(() => resolve());
    });
  });

  it('should successfully establish an encrypted mTLS session with valid client cert', async () => {
    const res = await runSecureCall(`127.0.0.1:${boundPort}`, true, 'AliceMtls');
    expect(res.message).toBe('Secure TLS Hello, AliceMtls!');
  });

  it('should reject unencrypted plaintext connection to TLS port', async () => {
    const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
    const { grpcObject } = loadProtoFile(protoPath);
    const helloworldPkg = grpcObject.helloworld;

    const insecureClient = new helloworldPkg.Greeter(
      `127.0.0.1:${boundPort}`,
      grpc.credentials.createInsecure(),
    );

    await expect(
      new Promise((resolve, reject) => {
        insecureClient.sayHello({ name: 'Hacker' }, (err, res) => {
          insecureClient.close();
          if (err) return reject(err);
          resolve(res);
        });
      }),
    ).rejects.toMatchObject({
      code: grpc.status.UNAVAILABLE,
    });
  });
});
