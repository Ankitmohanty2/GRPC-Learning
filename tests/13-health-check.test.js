const grpc = require('@grpc/grpc-js');
const { startHealthServer, healthService } = require('../lessons/13-health-checking/server');
const { checkHealth } = require('../lessons/13-health-checking/client');

describe('Lesson 13: Standard Health Checking', () => {
  let serverInstance;
  let boundPort;

  beforeAll(async () => {
    const result = await startHealthServer(0, '127.0.0.1');
    serverInstance = result.server;
    boundPort = result.port;
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      serverInstance.tryShutdown(() => resolve());
    });
  });

  it('should report SERVING for overall server and greeter service', async () => {
    const overall = await checkHealth(`127.0.0.1:${boundPort}`, '');
    expect(overall).toBe('SERVING');

    const greeter = await checkHealth(`127.0.0.1:${boundPort}`, 'helloworld.Greeter');
    expect(greeter).toBe('SERVING');
  });

  it('should dynamically update health status when service degrades', async () => {
    healthService.setStatus('helloworld.Greeter', 'NOT_SERVING');
    const status = await checkHealth(`127.0.0.1:${boundPort}`, 'helloworld.Greeter');
    expect(status).toBe('NOT_SERVING');

    healthService.setStatus('helloworld.Greeter', 'SERVING');
  });

  it('should return NOT_FOUND when probing unknown service', async () => {
    await expect(
      checkHealth(`127.0.0.1:${boundPort}`, 'unknown.FakeService'),
    ).rejects.toMatchObject({
      code: grpc.status.NOT_FOUND,
    });
  });
});
