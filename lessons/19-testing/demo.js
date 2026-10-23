const assert = require('assert');
const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createGrpcError } = require('../../src/common/errors');

async function runTestSuite() {
  console.log('\n🧪 Running Programmatic gRPC Integration Test Suite...');

  const proto = loadProtoFile(resolveProtoPath('helloworld', 'helloworld.proto')).grpcObject;

  const server = new grpc.Server();
  server.addService(proto.helloworld.Greeter.service, {
    sayHello: (call, callback) => {
      if (!call.request.name || call.request.name.trim() === '') {
        return callback(createGrpcError(grpc.status.INVALID_ARGUMENT, 'Name cannot be empty'));
      }
      callback(null, { message: `Hello, ${call.request.name}!` });
    },
  });

  const boundPort = await new Promise((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) return reject(err);
      resolve(port);
    });
  });

  const client = new proto.helloworld.Greeter(`127.0.0.1:${boundPort}`, grpc.credentials.createInsecure());

  try {
    console.log('1. Testing Unary Success Path...');
    const successRes = await new Promise((resolve, reject) => {
      client.sayHello({ name: 'JestRunner' }, (err, res) => (err ? reject(err) : resolve(res)));
    });
    assert.strictEqual(successRes.message, 'Hello, JestRunner!');
    console.log('   ✅ PASS: Expected message received');

    console.log('2. Testing Validation Failure Path...');
    let caughtErr = null;
    try {
      await new Promise((resolve, reject) => {
        client.sayHello({ name: '' }, (err, res) => (err ? reject(err) : resolve(res)));
      });
    } catch (err) {
      caughtErr = err;
    }
    assert(caughtErr !== null, 'Expected server to return an error');
    assert.strictEqual(caughtErr.code, grpc.status.INVALID_ARGUMENT);
    assert.match(caughtErr.details, /Name cannot be empty/);
    console.log('   ✅ PASS: Received INVALID_ARGUMENT as expected');

    console.log('\nAll in-memory gRPC programmatic tests passed successfully!\n');
  } finally {
    client.close();
    await new Promise((resolve) => server.tryShutdown(resolve));
  }
}

if (require.main === module) {
  runTestSuite().catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
}

module.exports = {
  runTestSuite,
};
