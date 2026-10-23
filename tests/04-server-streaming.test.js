const grpc = require('@grpc/grpc-js');
const { startServer } = require('../lessons/04-server-streaming/server');
const { runClient, createNotificationClient } = require('../lessons/04-server-streaming/client');

describe('Lesson 04: Server Streaming (WatchNotifications)', () => {
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

  it('should receive all 5 streamed notifications until clean end', async () => {
    const events = await runClient(`127.0.0.1:${boundPort}`, 'test_user_1', 0);
    expect(events.length).toBe(5);
    expect(events[0].id).toContain('notif_1');
    expect(events[4].id).toContain('notif_5');
  });

  it('should support client-initiated cancellation mid-stream', async () => {
    const events = await runClient(`127.0.0.1:${boundPort}`, 'test_user_cancel', 2);
    expect(events.length).toBe(2);
  });

  it('should return INVALID_ARGUMENT when user_id is empty', async () => {
    const client = createNotificationClient(`127.0.0.1:${boundPort}`);

    await expect(
      new Promise((resolve, reject) => {
        const stream = client.watchNotifications({ user_id: '', types: [] });
        stream.on('data', () => {});
        stream.on('end', () => resolve(true));
        stream.on('error', (err) => reject(err));
      }),
    ).rejects.toMatchObject({
      code: grpc.status.INVALID_ARGUMENT,
    });

    client.close();
  });
});
