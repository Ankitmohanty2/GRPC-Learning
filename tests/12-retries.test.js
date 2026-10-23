const { startServer, resetFlakyAttempts } = require('../lessons/12-cancellation-and-retries/server');
const { callWithRetry, callAndCancel } = require('../lessons/12-cancellation-and-retries/client');

describe('Lesson 12: Cancellation and Retries', () => {
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

  beforeEach(() => {
    resetFlakyAttempts();
  });

  it('should successfully retry after encountering transient UNAVAILABLE errors', async () => {
    const res = await callWithRetry(`127.0.0.1:${boundPort}`, 'flaky_test');
    expect(res.message).toContain('Success on attempt #3');
  });

  it('should support client-side cancellation mid-flight', async () => {
    await expect(callAndCancel(`127.0.0.1:${boundPort}`)).resolves.not.toThrow();
  });
});
