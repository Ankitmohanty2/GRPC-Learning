const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_LOADER_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

function resolveProtoPath(...segments) {
  return path.join(process.cwd(), 'proto', ...segments);
}

function loadProtoFile(protoPath) {
  const includeDirs = [path.join(process.cwd(), 'proto')];
  const packageDefinition = protoLoader.loadSync(protoPath, {
    ...PROTO_LOADER_OPTIONS,
    includeDirs,
  });
  const grpcObject = grpc.loadPackageDefinition(packageDefinition);
  return { grpcObject, packageDefinition };
}

module.exports = {
  PROTO_LOADER_OPTIONS,
  resolveProtoPath,
  loadProtoFile,
};
