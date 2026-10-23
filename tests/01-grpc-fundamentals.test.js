const { startServer } = require('../lessons/01-grpc-fundamentals/server');
const { runClient } = require('../lessons/01-grpc-fundamentals/client');

describe('Lesson 01: gRPC Fundamentals (Hello World)', () => {
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

  it('should successfully send a greeting to Alice', async () => {
    const response = await runClient(`127.0.0.1:${boundPort}`, 'Alice');
    expect(response).toBeDefined();
    expect(response.message).toBe('Hello, Alice!');
  });

  it('should default to "World" when name is empty', async () => {
    const response = await runClient(`127.0.0.1:${boundPort}`, '');
    expect(response).toBeDefined();
    expect(response.message).toBe('Hello, World!');
  });
});
