const { startExpressServer, startGrpcServer } = require('../lessons/16-rest-vs-grpc/benchmark');
const { loadProtoFile, resolveProtoPath } = require('../src/common/proto-loader');
const grpc = require('@grpc/grpc-js');

describe('Lesson 16: REST vs gRPC Comparison', () => {
  let expressApp;
  let grpcApp;

  beforeAll(async () => {
    expressApp = await startExpressServer();
    grpcApp = await startGrpcServer();
  });

  afterAll(async () => {
    await new Promise((r) => grpcApp.server.tryShutdown(r));
    await new Promise((r) => expressApp.server.close(r));
  });

  it('should verify Express REST endpoint returns user JSON', async () => {
    const res = await fetch(`http://127.0.0.1:${expressApp.port}/users/usr_100`);
    const data = await res.json();
    expect(data.id).toBe('usr_100');
    expect(data.email).toBe('alice@example.com');
  });

  it('should verify gRPC endpoint returns equivalent user protobuf', async () => {
    const protoPath = resolveProtoPath('users', 'v1', 'users.proto');
    const { grpcObject } = loadProtoFile(protoPath);
    const client = new grpcObject.users.v1.UserService(
      `127.0.0.1:${grpcApp.port}`,
      grpc.credentials.createInsecure(),
    );

    const res = await new Promise((resolve, reject) => {
      client.getUser({ id: 'usr_100' }, (err, response) => {
        client.close();
        if (err) return reject(err);
        resolve(response);
      });
    });

    expect(res.user.id).toBe('usr_100');
    expect(res.user.email).toBe('alice@example.com');
  });
});
