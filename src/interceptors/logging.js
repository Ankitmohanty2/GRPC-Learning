const grpc = require('@grpc/grpc-js');
const { createLogger } = require('../config/logger');

const logger = createLogger('grpc-interceptor');

function clientLoggingInterceptor(options, nextCall) {
  return new grpc.InterceptingCall(nextCall(options), {
    start: (metadata, listener, next) => {
      const correlationId =
        metadata.get('x-correlation-id')[0]?.toString() ||
        `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      metadata.set('x-correlation-id', correlationId);

      const startTime = performance.now();
      logger.info(
        { method: options.method_definition.path, correlationId },
        'Client outbound gRPC call started',
      );

      const interceptedListener = {
        onReceiveMetadata: (meta, nextMeta) => nextMeta(meta),
        onReceiveMessage: (msg, nextMsg) => nextMsg(msg),
        onReceiveStatus: (status, nextStatus) => {
          const durationMs = (performance.now() - startTime).toFixed(2);
          logger.info(
            {
              method: options.method_definition.path,
              correlationId,
              code: status.code,
              durationMs,
            },
            'Client call completed',
          );
          nextStatus(status);
        },
      };

      next(metadata, interceptedListener);
    },
  });
}

module.exports = {
  clientLoggingInterceptor,
};
