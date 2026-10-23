const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');

const logger = createLogger('15-load-balancing');

function startWorkerInstance(instanceId, port = 0) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
    const { grpcObject } = loadProtoFile(protoPath);
    const helloworldPkg = grpcObject.helloworld;

    const server = new grpc.Server();
    server.addService(helloworldPkg.Greeter.service, {
      sayHello: (call, cb) => {
        logger.info({ instanceId }, 'Processed request on backend instance');
        cb(null, { message: `Served by Backend Worker #${instanceId}` });
      },
    });

    server.bindAsync('127.0.0.1:' + port, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      resolve({ server, port: boundPort, instanceId });
    });
  });
}

async function runLoadBalancingDemo() {
  const instances = await Promise.all([
    startWorkerInstance(1),
    startWorkerInstance(2),
    startWorkerInstance(3),
  ]);

  const ports = instances.map((i) => i.port);
  console.log(`Started 3 backend instances on ports: ${ports.join(', ')}`);

  const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const GreeterClient = grpcObject.helloworld.Greeter;

  const clients = ports.map((p) => new GreeterClient(`127.0.0.1:${p}`, grpc.credentials.createInsecure()));

  console.log('\n--- Distributing 6 RPC Requests Round-Robin ---');
  for (let i = 0; i < 6; i++) {
    const targetClient = clients[i % clients.length];
    const res = await new Promise((resolve, reject) => {
      targetClient.sayHello({ name: `Req_${i + 1}` }, (err, response) => {
        if (err) return reject(err);
        resolve(response);
      });
    });
    console.log(`Request #${i + 1} -> ${res.message}`);
  }

  for (const c of clients) c.close();
  for (const inst of instances) {
    await new Promise((r) => inst.server.tryShutdown(r));
  }
}

if (require.main === module) {
  runLoadBalancingDemo().catch(console.error);
}

module.exports = {
  startWorkerInstance,
  runLoadBalancingDemo,
};
