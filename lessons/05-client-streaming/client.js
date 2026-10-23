const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');

const logger = createLogger('05-client-streaming-client');
const env = getEnv();

function createMeasurementClient(target = `${env.HOST}:${env.PORT + 4}`) {
  const protoPath = resolveProtoPath('measurements', 'v1', 'measurements.proto');
  const { grpcObject } = loadProtoFile(protoPath);
  const measurementsPkg = grpcObject.measurements?.v1;
  return new measurementsPkg.MeasurementService(target, grpc.credentials.createInsecure());
}

function runClient(target = `${env.HOST}:${env.PORT + 4}`, measurementsToSend) {
  return new Promise((resolve, reject) => {
    const client = createMeasurementClient(target);

    logger.info({ target }, 'Starting Client-Streaming measurement upload');

    const stream = client.uploadMeasurements((err, summary) => {
      if (err) {
        logger.error({ code: err.code, details: err.details }, 'UploadMeasurements failed');
        client.close();
        return reject(err);
      }

      logger.info({ summary }, 'Received aggregated upload summary from server');
      console.log('\n📊 Sensor Upload Summary:');
      console.log(`- Total Received: ${summary.total_received}`);
      console.log(`- Accepted:       ${summary.total_accepted}`);
      console.log(`- Rejected:       ${summary.total_rejected}`);
      console.log(`- Average Value:  ${summary.average_value}`);
      console.log(`- Min Value:      ${summary.min_value}`);
      console.log(`- Max Value:      ${summary.max_value}\n`);

      client.close();
      resolve(summary);
    });

    const items = measurementsToSend || [
      { sensor_id: 'sensor-temp-01', value: 21.5, unit: 'celsius' },
      { sensor_id: 'sensor-temp-01', value: 22.0, unit: 'celsius' },
      { sensor_id: 'sensor-temp-01', value: 24.5, unit: 'celsius' },
      { sensor_id: '', value: 10.0, unit: 'celsius' },
      { sensor_id: 'sensor-temp-01', value: 20.0, unit: 'celsius' },
    ];

    for (const item of items) {
      console.log(`📤 Streaming measurement: sensor=${item.sensor_id || '<missing>'}, val=${item.value}`);
      stream.write({
        ...item,
        recorded_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      });
    }

    console.log('🏁 Finished writing chunks, calling stream.end()');
    stream.end();
  });
}

if (require.main === module) {
  runClient()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  createMeasurementClient,
  runClient,
};
