const grpc = require('@grpc/grpc-js');
const { startServer } = require('../lessons/10-authentication-and-authorization/server');
const { makeAuthenticatedCall } = require('../lessons/10-authentication-and-authorization/client');
const { generateToken } = require('../src/interceptors/auth');

describe('Lesson 10: Authentication and Authorization', () => {
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

  it('should return UNAUTHENTICATED when token is omitted', async () => {
    await expect(
      makeAuthenticatedCall(`127.0.0.1:${boundPort}`, undefined),
    ).rejects.toMatchObject({
      code: grpc.status.UNAUTHENTICATED,
    });
  });

  it('should return UNAUTHENTICATED when token signature is invalid', async () => {
    await expect(
      makeAuthenticatedCall(`127.0.0.1:${boundPort}`, 'invalid.jwt.token'),
    ).rejects.toMatchObject({
      code: grpc.status.UNAUTHENTICATED,
    });
  });

  it('should allow regular user to call standard methods', async () => {
    const token = generateToken({ userId: 'u1', role: 'user', email: 'u1@test.com' });
    const res = await makeAuthenticatedCall(`127.0.0.1:${boundPort}`, token, 'standard_greeting');
    expect(res.message).toContain('Hello u1@test.com!');
    expect(res.message).toContain('Role: user');
  });

  it('should return PERMISSION_DENIED when regular user attempts admin action', async () => {
    const token = generateToken({ userId: 'u1', role: 'user', email: 'u1@test.com' });
    await expect(
      makeAuthenticatedCall(`127.0.0.1:${boundPort}`, token, 'admin_only_purge'),
    ).rejects.toMatchObject({
      code: grpc.status.PERMISSION_DENIED,
    });
  });

  it('should allow admin user to execute admin-only actions', async () => {
    const adminToken = generateToken({ userId: 'adm_1', role: 'admin', email: 'root@test.com' });
    const res = await makeAuthenticatedCall(`127.0.0.1:${boundPort}`, adminToken, 'admin_only_purge');
    expect(res.message).toContain('Hello root@test.com!');
    expect(res.message).toContain('Role: admin');
  });
});
