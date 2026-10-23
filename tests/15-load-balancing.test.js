const { startWorkerInstance } = require('../lessons/15-load-balancing/demo');
const { loadProtoFile, resolveProtoPath } = require('../src/common/proto-loader');
const grpc = require('@grpc/grpc-js');

describe('Lesson 15: Load Balancing across multiple backend workers', () => {
  let workers = [];

  beforeAll(async () => {
    workers = await Promise.all([
      startWorkerInstance(1),
      startWorkerInstance(2),
    ]);
  });

  afterAll(async () => {
    for (const w of workers) {
      await new Promise((r) => w.server.tryShutdown(r));
    }
  });

  it('should receive responses from distinct backend instances', async () => {
    const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
    const { grpcObject } = loadProtoFile(protoPath);
    const GreeterClient = grpcObject.helloworld.Greeter;

    const client1 = new GreeterClient(`127.0.0.1:${workers[0].port}`, grpc.credentials.createInsecure());
    const client2 = new GreeterClient(`127.0.0.1:${workers[1].port}`, grpc.credentials.createInsecure());

    const res1 = await new Promise((res, rej) => client1.sayHello({ name: 'A' }, (err, r) => err ? rej(err) : res(r)));
    const res2 = await new Promise((res, rej) => client2.sayHello({ name: 'B' }, (err, r) => err ? rej(err) : res(r)));

    expect(res1.message).toBe('Served by Backend Worker #1');
    expect(res2.message).toBe('Served by Backend Worker #2');

    client1.close();
    client2.close();
  });
});
