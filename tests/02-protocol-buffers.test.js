const { startServer } = require('../lessons/02-protocol-buffers/server');
const { runClient } = require('../lessons/02-protocol-buffers/client');

describe('Lesson 02: Protocol Buffers Types Showcase', () => {
  let serverInstance;
  let boundPort;

  beforeAll(async () => {
    const result = await startServer(0, '127.0.0.1');
    serverInstance = result.server;
    boundPort = result.port;
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      serverInstance.tryShutdown(() => resolve());
    });
  });

  it('should preserve all types across round-trip serialization', async () => {
    const res = await runClient(`127.0.0.1:${boundPort}`);
    expect(res.name).toBe('Alice In Wonderland');
    expect(res.age).toBe(28);
    expect(res.big_id).toBe('9007199254740993');
    expect(res.priority).toBe('PRIORITY_HIGH');
    expect(res.address.city).toBe('Cloudville');
    expect(res.tags).toContain('javascript');
    expect(res.metadata.env).toBe('development');
    expect(res.email).toBe('alice@distributed.systems');
    expect(res.nickname).toBe('ProtobufHacker');
  });

  it('should handle oneof mutability correctly', async () => {
    const res = await runClient(`127.0.0.1:${boundPort}`, {
      phone: '+1-555-0199',
    });
    expect(res.phone).toBe('+1-555-0199');
  });
});
