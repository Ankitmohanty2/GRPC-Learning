const grpc = require('@grpc/grpc-js');
const { startReflectedServer } = require('../lessons/14-reflection-and-debugging/demo');
const { loadProtoFile, resolveProtoPath } = require('../src/common/proto-loader');

describe('Lesson 14: Server Reflection and Debugging', () => {
  let serverInstance;
  let boundPort;

  beforeAll(async () => {
    const result = await startReflectedServer(0, '127.0.0.1');
    serverInstance = result.server;
    boundPort = result.port;
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      serverInstance.tryShutdown(() => resolve());
    });
  });

  it('should accept calls on reflected Greeter service', async () => {
    const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
    const { grpcObject } = loadProtoFile(protoPath);
    const client = new grpcObject.helloworld.Greeter(
      `127.0.0.1:${boundPort}`,
      grpc.credentials.createInsecure(),
    );

    const res = await new Promise((resolve, reject) => {
      client.sayHello({ name: 'Inspector' }, (err, response) => {
        client.close();
        if (err) return reject(err);
        resolve(response);
      });
    });

    expect(res.message).toBe('Reflection Hello, Inspector!');
  });
});
