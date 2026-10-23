const grpc = require('@grpc/grpc-js');
const { startServer } = require('../lessons/03-unary-rpc/server');
const { createUserServiceClient } = require('../lessons/03-unary-rpc/client');

describe('Lesson 03: Unary RPC (UserService)', () => {
  let serverInstance;
  let client;

  beforeAll(async () => {
    const result = await startServer(0, '127.0.0.1');
    serverInstance = result.server;
    client = createUserServiceClient(`127.0.0.1:${result.port}`);
  });

  afterAll(async () => {
    client.close();
    await new Promise((resolve) => {
      serverInstance.tryShutdown(() => resolve());
    });
  });

  it('should create a new user successfully', async () => {
    const res = await new Promise((resolve, reject) => {
      client.createUser(
        { name: 'Diana Prince', email: 'diana@themyscira.io' },
        (err, resp) => (err ? reject(err) : resolve(resp)),
      );
    });

    expect(res.user.id).toBeDefined();
    expect(res.user.name).toBe('Diana Prince');
    expect(res.user.email).toBe('diana@themyscira.io');
    expect(res.user.status).toBe('USER_STATUS_ACTIVE');
  });

  it('should return INVALID_ARGUMENT when email is invalid', async () => {
    await expect(
      new Promise((resolve, reject) => {
        client.createUser(
          { name: 'Invalid User', email: 'not-an-email' },
          (err, resp) => (err ? reject(err) : resolve(resp)),
        );
      }),
    ).rejects.toMatchObject({
      code: grpc.status.INVALID_ARGUMENT,
    });
  });

  it('should return ALREADY_EXISTS when email is already taken', async () => {
    await expect(
      new Promise((resolve, reject) => {
        client.createUser(
          { name: 'Diana Duplicate', email: 'diana@themyscira.io' },
          (err, resp) => (err ? reject(err) : resolve(resp)),
        );
      }),
    ).rejects.toMatchObject({
      code: grpc.status.ALREADY_EXISTS,
    });
  });

  it('should return NOT_FOUND when getting non-existent user', async () => {
    await expect(
      new Promise((resolve, reject) => {
        client.getUser({ id: 'non_existent_999' }, (err, resp) =>
          err ? reject(err) : resolve(resp),
        );
      }),
    ).rejects.toMatchObject({
      code: grpc.status.NOT_FOUND,
    });
  });

  it('should paginate users properly', async () => {
    const res = await new Promise((resolve, reject) => {
      client.listUsers(
        { pagination: { page_size: 1 } },
        (err, resp) => (err ? reject(err) : resolve(resp)),
      );
    });

    expect(res.users.length).toBe(1);
    expect(res.pagination.total_count).toBeGreaterThanOrEqual(1);
    expect(res.pagination.next_page_token).toBeTruthy();
  });
});
