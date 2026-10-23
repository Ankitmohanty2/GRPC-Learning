const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('05-client-streaming-server');
const env = getEnv();

function uploadMeasurements(call, callback) {
  let totalReceived = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let sum = 0;
  let minValue = Infinity;
  let maxValue = -Infinity;

  logger.info({ peer: call.getPeer() }, 'Client initiated measurement upload stream');

  call.on('data', (measurement) => {
    totalReceived++;

    if (!measurement.sensor_id || !Number.isFinite(measurement.value) || measurement.value < -273.15) {
      totalRejected++;
      logger.warn({ measurement }, 'Rejected invalid measurement');
      return;
    }

    totalAccepted++;
    sum += measurement.value;
    if (measurement.value < minValue) minValue = measurement.value;
    if (measurement.value > maxValue) maxValue = measurement.value;

    logger.debug(
      { sensor_id: measurement.sensor_id, value: measurement.value },
      'Processed measurement chunk',
    );
  });

  call.on('end', () => {
    const averageValue = totalAccepted > 0 ? sum / totalAccepted : 0;
    const finalMin = totalAccepted > 0 ? minValue : 0;
    const finalMax = totalAccepted > 0 ? maxValue : 0;

    const summary = {
      total_received: totalReceived,
      total_accepted: totalAccepted,
      total_rejected: totalRejected,
      average_value: Number(averageValue.toFixed(2)),
      min_value: Number(finalMin.toFixed(2)),
      max_value: Number(finalMax.toFixed(2)),
    };

    logger.info({ summary }, 'Measurement stream finished. Returning summary.');
    callback(null, summary);
  });

  call.on('error', (err) => {
    logger.error({ err }, 'Client stream errored abruptly');
  });

  call.on('cancelled', () => {
    logger.warn('Client cancelled measurement upload stream');
  });
}

function startServer(port = env.PORT + 4, host = env.HOST) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('measurements', 'v1', 'measurements.proto');
    const { grpcObject, packageDefinition } = loadProtoFile(protoPath);

    const measurementsPkg = grpcObject.measurements?.v1;
    if (!measurementsPkg?.MeasurementService?.service) {
      throw new Error('MeasurementService not found in measurements.proto');
    }

    const server = new grpc.Server();
    server.addService(measurementsPkg.MeasurementService.service, {
      uploadMeasurements,
    });

    const reflection = new ReflectionService(packageDefinition);
    reflection.addToServer(server);

    const address = `${host}:${port}`;
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        logger.error({ err, address }, 'Failed to bind MeasurementService server');
        return reject(err);
      }
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC MeasurementService Client-Streaming server running');
      resolve({ server, port: boundPort });
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err }, 'Server fatal error');
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
