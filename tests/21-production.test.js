const grpc = require('@grpc/grpc-js');
const { startProductionServer, CHANNEL_OPTIONS } = require('../lessons/21-production-best-practices/production-server');
const { loadProtoFile, resolveProtoPath } = require('../src/common/proto-loader');

describe('Lesson 21: Production Hardened Server', () => {
  let serverInstance;
  let port;
  let client;

  beforeAll(async () => {
    const res = await startProductionServer(0, '127.0.0.1');
    serverInstance = res.server;
    port = res.port;

    const proto = loadProtoFile(resolveProtoPath('helloworld', 'helloworld.proto')).grpcObject;
    client = new proto.helloworld.Greeter(`127.0.0.1:${port}`, grpc.credentials.createInsecure(), CHANNEL_OPTIONS);
  });

  afterAll(async () => {
    if (client) client.close();
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.tryShutdown(resolve));
    }
  });

  it('exposes channel configuration options', () => {
    expect(CHANNEL_OPTIONS['grpc.keepalive_time_ms']).toBe(30000);
    expect(CHANNEL_OPTIONS['grpc.max_receive_message_length']).toBe(4194304);
  });

  it('handles client calls successfully on production server', async () => {
    const response = await new Promise((resolve, reject) => {
      client.sayHello({ name: 'ProdUser' }, (err, res) => (err ? reject(err) : resolve(res)));
    });
    expect(response.message).toBe('Hello, ProdUser!');
  });

  it('provides standard health check status', async () => {
    const healthProto = loadProtoFile(resolveProtoPath('grpc', 'health', 'v1', 'health.proto')).grpcObject;
    const healthClient = new healthProto.grpc.health.v1.Health(`127.0.0.1:${port}`, grpc.credentials.createInsecure());

    const status = await new Promise((resolve, reject) => {
      healthClient.check({ service: '' }, (err, res) => (err ? reject(err) : resolve(res)));
    });
    expect(status.status).toBe('SERVING');
    healthClient.close();
  });
});
