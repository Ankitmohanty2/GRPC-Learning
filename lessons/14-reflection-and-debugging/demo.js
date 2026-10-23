const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');

const logger = createLogger('14-reflection-demo');

function startReflectedServer(port = 50064, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('helloworld', 'helloworld.proto');
    const { grpcObject, packageDefinition } = loadProtoFile(protoPath);

    const helloworldPkg = grpcObject.helloworld;
    const server = new grpc.Server();

    server.addService(helloworldPkg.Greeter.service, {
      sayHello: (call, cb) => cb(null, { message: `Reflection Hello, ${call.request.name}!` }),
    });

    const reflection = new ReflectionService(packageDefinition);
    reflection.addToServer(server);

    server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      logger.info({ port: boundPort }, 'Server with Reflection enabled running');
      resolve({ server, port: boundPort });
    });
  });
}

if (require.main === module) {
  startReflectedServer().then(({ port }) => {
    console.log(`\nServer Reflection running on 127.0.0.1:${port}`);
    console.log('You can now inspect this server with grpcurl:');
    console.log(`  grpcurl -plaintext 127.0.0.1:${port} list`);
    console.log(`  grpcurl -plaintext 127.0.0.1:${port} describe helloworld.Greeter`);
    console.log(`  grpcurl -plaintext -d "{\\"name\\":\\"Alice\\"}" 127.0.0.1:${port} helloworld.Greeter/SayHello\n`);
  });
}

module.exports = {
  startReflectedServer,
};
