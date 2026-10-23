const grpc = require('@grpc/grpc-js');
const { startServer } = require('../lessons/08-error-handling/server');
const { testErrorScenario } = require('../lessons/08-error-handling/client');

describe('Lesson 08: Errors and Status Codes', () => {
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

  it('should return INVALID_ARGUMENT with rich error metadata for short name', async () => {
    const res = await testErrorScenario(`127.0.0.1:${boundPort}`, 'x');
    expect(res.code).toBe(grpc.status.INVALID_ARGUMENT);
    expect(res.metadata?.['x-field-name']).toBe('name');
    expect(res.metadata?.['x-constraint']).toBe('min_length_2');
  });

  it('should return RESOURCE_EXHAUSTED with retry metadata for spammer', async () => {
    const res = await testErrorScenario(`127.0.0.1:${boundPort}`, 'spammer');
    expect(res.code).toBe(grpc.status.RESOURCE_EXHAUSTED);
    expect(res.metadata?.['retry-after-ms']).toBe('5000');
  });

  it('should sanitize INTERNAL errors and avoid leaking sensitive stack traces', async () => {
    const res = await testErrorScenario(`127.0.0.1:${boundPort}`, 'trigger_db_crash');
    expect(res.code).toBe(grpc.status.INTERNAL);
    expect(res.details).not.toContain('postgres');
    expect(res.details).not.toContain('production_credentials');
    expect(res.details).toContain('An internal error occurred');
  });
});
