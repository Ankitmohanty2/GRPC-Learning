const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('02-protobuf-client');
const env = getEnv();

function runClient(target = `${env.HOST}:${env.PORT + 1}`, overrides = {}) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('types_demo', 'v1', 'types_demo.proto');
    const { grpcObject } = loadProtoFile(protoPath);

    const typesDemoPkg = grpcObject.types_demo?.v1;
    const TypesDemoClient = typesDemoPkg.TypesDemoService;

    const client = new TypesDemoClient(target, grpc.credentials.createInsecure());

    const payload = {
      name: 'Alice In Wonderland',
      age: 28,
      big_id: '9007199254740993',
      count: 100,
      delta: -42,
      score: 98.5,
      precise_score: 99.99999912345,
      is_active: true,
      avatar: Buffer.from('gRPC-binary-avatar-data'),
      priority: 'PRIORITY_HIGH',
      address: {
        street: '123 Distributed Way',
        city: 'Cloudville',
        state: 'CA',
        zip_code: '94043',
        country: 'USA',
      },
      tags: ['javascript', 'grpc', 'protobuf', 'microservices'],
      metadata: {
        env: 'development',
        tier: 'gold',
        cluster: 'us-west-2',
      },
      email: 'alice@distributed.systems',
      nickname: 'ProtobufHacker',
      created_at: {
        seconds: Math.floor(Date.now() / 1000),
        nanos: 0,
      },
      ...overrides,
    };

    logger.info('Sending TypesShowcase Echo request with full type coverage');

    client.echo(payload, (err, response) => {
      if (err) {
        logger.error({ code: err.code, details: err.details }, 'TypesDemo Echo failed');
        client.close();
        return reject(err);
      }

      logger.info('Received Echo response successfully');
      console.log('\n📦 Protobuf Wire Round-Trip Verified:');
      console.log(`- name: ${response.name}`);
      console.log(`- big_id (int64 as string): ${response.big_id}`);
      console.log(`- priority (enum): ${response.priority}`);
      console.log(`- address.city: ${response.address?.city}`);
      console.log(`- tags count: ${response.tags?.length}`);
      console.log(`- metadata.env: ${response.metadata?.env}`);
      console.log(`- contact (oneof): email="${response.email}"`);
      console.log(`- nickname (optional presence): "${response.nickname}"\n`);

      client.close();
      resolve(response);
    });
  });
}

if (require.main === module) {
  runClient()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  runClient,
};
