const fs = require('fs');
const path = require('path');
const protoLoader = require('@grpc/proto-loader');

function findProtoFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findProtoFiles(fullPath, fileList);
    } else if (item.endsWith('.proto')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const protoDir = path.resolve(__dirname, '../proto');
const protoFiles = findProtoFiles(protoDir);

let hasErrors = false;

for (const protoFile of protoFiles) {
  try {
    protoLoader.loadSync(protoFile, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [protoDir]
    });
    console.log(`[OK] Valid proto: ${path.relative(protoDir, protoFile)}`);
  } catch (error) {
    hasErrors = true;
    console.error(`[ERROR] Failed to load proto ${protoFile}:`, error.message);
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log(`All ${protoFiles.length} protocol buffer files validated successfully.`);
}
