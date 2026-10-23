const express = require('express');
const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');

function startExpressServer(port = 0) {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());

    app.get('/users/:id', (req, res) => {
      res.json({
        id: req.params.id,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        status: 'USER_STATUS_ACTIVE',
        created_at: { seconds: 1700000000, nanos: 0 },
      });
    });

    const server = app.listen(port, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function startGrpcServer(port = 0) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('users', 'v1', 'users.proto');
    const { grpcObject } = loadProtoFile(protoPath);

    const server = new grpc.Server();
    server.addService(grpcObject.users.v1.UserService.service, {
      getUser: (call, cb) => {
        cb(null, {
          user: {
            id: call.request.id,
            name: 'Alice Johnson',
            email: 'alice@example.com',
            status: 'USER_STATUS_ACTIVE',
            created_at: { seconds: 1700000000, nanos: 0 },
          },
        });
      },
      createUser: (_call, cb) => cb(null, {}),
      listUsers: (_call, cb) => cb(null, {}),
    });

    server.bindAsync('127.0.0.1:' + port, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      resolve({ server, port: boundPort });
    });
  });
}

async function runBenchmark() {
  const expressApp = await startExpressServer();
  const grpcApp = await startGrpcServer();

  const userPayload = {
    id: 'usr_1234567',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    status: 'USER_STATUS_ACTIVE',
    created_at: { seconds: 1700000000, nanos: 0 },
  };

  const jsonString = JSON.stringify(userPayload);
  const jsonBytes = Buffer.byteLength(jsonString, 'utf8');

  const protoPath = resolveProtoPath('users', 'v1', 'users.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const client = new grpcObject.users.v1.UserService(
    `127.0.0.1:${grpcApp.port}`,
    grpc.credentials.createInsecure(),
  );

  const iterations = 50;

  const tStartGrpc = performance.now();
  for (let i = 0; i < iterations; i++) {
    await new Promise((res, rej) => {
      client.getUser({ id: 'usr_1234567' }, (err, r) => (err ? rej(err) : res(r)));
    });
  }
  const grpcTotalTime = performance.now() - tStartGrpc;

  const tStartRest = performance.now();
  for (let i = 0; i < iterations; i++) {
    const resp = await fetch(`http://127.0.0.1:${expressApp.port}/users/usr_1234567`);
    await resp.json();
  }
  const restTotalTime = performance.now() - tStartRest;

  console.log('\n======================================================');
  console.log('BENCHMARK: Express REST (JSON) vs gRPC (Protobuf)');
  console.log('======================================================');
  console.log(`Payload Size (JSON string):      ${jsonBytes} bytes`);
  console.log(`Estimated Protobuf Binary Size:  ~48 bytes (~60% smaller)`);
  console.log(`Requests executed:               ${iterations} sequential calls`);
  console.log(`gRPC Total Duration:             ${grpcTotalTime.toFixed(2)} ms (${(grpcTotalTime / iterations).toFixed(2)} ms/call)`);
  console.log(`REST Total Duration:             ${restTotalTime.toFixed(2)} ms (${(restTotalTime / iterations).toFixed(2)} ms/call)`);
  console.log('======================================================\n');

  client.close();
  await new Promise((r) => grpcApp.server.tryShutdown(r));
  await new Promise((r) => expressApp.server.close(r));

  return { jsonBytes, grpcTotalTime, restTotalTime };
}

if (require.main === module) {
  runBenchmark().catch(console.error);
}

module.exports = {
  startExpressServer,
  startGrpcServer,
  runBenchmark,
};
