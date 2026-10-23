const grpc = require('@grpc/grpc-js');
const { startServer } = require('../lessons/07-deadlines-and-timeouts/server');
const { callWithTimeout } = require('../lessons/07-deadlines-and-timeouts/client');

describe('Lesson 07: Deadlines and Timeouts', () => {
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

  it('should succeed when deadline is generous (1000ms vs 300ms server work)', async () => {
    const res = await callWithTimeout(`127.0.0.1:${boundPort}`, 1000);
    expect(res.message).toContain('Hello after 300ms');
  });

  it('should fail with DEADLINE_EXCEEDED when deadline is tighter than server work (50ms vs 300ms)', async () => {
    await expect(
      callWithTimeout(`127.0.0.1:${boundPort}`, 50),
    ).rejects.toMatchObject({
      code: grpc.status.DEADLINE_EXCEEDED,
    });
  });
});
