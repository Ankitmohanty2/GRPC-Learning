const { startServer } = require('../lessons/09-metadata-and-interceptors/server');
const { runClientWithMetadata } = require('../lessons/09-metadata-and-interceptors/client');

describe('Lesson 09: Metadata and Interceptors', () => {
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

  it('should propagate correlation ID and receive server trailers', async () => {
    const customId = `corr-test-${Date.now()}`;
    const result = await runClientWithMetadata(`127.0.0.1:${boundPort}`, customId);

    expect(result.message).toBe('Hello, InterceptorUser!');
    expect(result.trailers['x-correlation-id']).toBe(customId);
    expect(result.trailers['x-server-execution-time-ms']).toBeDefined();
  });
});
