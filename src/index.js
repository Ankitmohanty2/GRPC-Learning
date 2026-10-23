const { getEnv } = require('./config/env');
const { createLogger } = require('./config/logger');
const { loadProtoFile, resolveProtoPath } = require('./common/proto-loader');
const { createGrpcError, isGrpcError, statusName } = require('./common/errors');
const { sharedUserRepository } = require('./services/user-repository');

module.exports = {
  getEnv,
  createLogger,
  loadProtoFile,
  resolveProtoPath,
  createGrpcError,
  isGrpcError,
  statusName,
  sharedUserRepository,
};
