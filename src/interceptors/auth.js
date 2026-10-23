const grpc = require('@grpc/grpc-js');
const jwt = require('jsonwebtoken');
const { createGrpcError } = require('../common/errors');

const JWT_SECRET = process.env.JWT_SECRET || 'grpc-learning-demo-secret-key-32-chars!!';

function generateToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function createAuthMetadata(token) {
  const meta = new grpc.Metadata();
  meta.set('authorization', `Bearer ${token}`);
  return meta;
}

function verifyAuthMetadata(metadata) {
  const authHeader = metadata.get('authorization')[0]?.toString();
  if (!authHeader) {
    throw createGrpcError(grpc.status.UNAUTHENTICATED, 'Missing Authorization metadata header');
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw createGrpcError(grpc.status.UNAUTHENTICATED, 'Malformed Authorization header. Format: Bearer <token>');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (_err) {
    throw createGrpcError(grpc.status.UNAUTHENTICATED, 'Invalid or expired authentication token');
  }
}

module.exports = {
  generateToken,
  createAuthMetadata,
  verifyAuthMetadata,
};
