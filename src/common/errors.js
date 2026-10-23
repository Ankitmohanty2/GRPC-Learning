const grpc = require('@grpc/grpc-js');

function createGrpcError(code, message, metadata) {
  const err = { code, details: message };
  if (metadata) {
    err.metadata = metadata;
  }
  return err;
}

function isGrpcError(err) {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof err.code === 'number'
  );
}

function statusName(code) {
  const names = {
    [grpc.status.OK]: 'OK',
    [grpc.status.CANCELLED]: 'CANCELLED',
    [grpc.status.UNKNOWN]: 'UNKNOWN',
    [grpc.status.INVALID_ARGUMENT]: 'INVALID_ARGUMENT',
    [grpc.status.DEADLINE_EXCEEDED]: 'DEADLINE_EXCEEDED',
    [grpc.status.NOT_FOUND]: 'NOT_FOUND',
    [grpc.status.ALREADY_EXISTS]: 'ALREADY_EXISTS',
    [grpc.status.PERMISSION_DENIED]: 'PERMISSION_DENIED',
    [grpc.status.RESOURCE_EXHAUSTED]: 'RESOURCE_EXHAUSTED',
    [grpc.status.FAILED_PRECONDITION]: 'FAILED_PRECONDITION',
    [grpc.status.ABORTED]: 'ABORTED',
    [grpc.status.OUT_OF_RANGE]: 'OUT_OF_RANGE',
    [grpc.status.UNIMPLEMENTED]: 'UNIMPLEMENTED',
    [grpc.status.INTERNAL]: 'INTERNAL',
    [grpc.status.UNAVAILABLE]: 'UNAVAILABLE',
    [grpc.status.DATA_LOSS]: 'DATA_LOSS',
    [grpc.status.UNAUTHENTICATED]: 'UNAUTHENTICATED',
  };
  return names[code] || `UNKNOWN_CODE_${code}`;
}

module.exports = {
  createGrpcError,
  isGrpcError,
  statusName,
};
