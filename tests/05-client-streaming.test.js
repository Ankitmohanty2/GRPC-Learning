const { startServer } = require('../lessons/05-client-streaming/server');
const { runClient } = require('../lessons/05-client-streaming/client');

describe('Lesson 05: Client Streaming (UploadMeasurements)', () => {
  let serverInstance;
  let boundPort;

  beforeAll(async () => {
    const result = await startServer(0, '127.0.0.1');
    serverInstance = result.server;
    boundPort = result.port;
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      serverInstance.tryShutdown(() => resolve());
    });
  });

  it('should accept valid measurements and reject invalid items', async () => {
    const summary = await runClient(`127.0.0.1:${boundPort}`, [
      { sensor_id: 'sensor-1', value: 10, unit: 'celsius' },
      { sensor_id: 'sensor-1', value: 20, unit: 'celsius' },
      { sensor_id: 'sensor-1', value: 30, unit: 'celsius' },
      { sensor_id: '', value: 99, unit: 'celsius' },
      { sensor_id: 'sensor-1', value: -300, unit: 'celsius' },
    ]);

    expect(summary.total_received).toBe(5);
    expect(summary.total_accepted).toBe(3);
    expect(summary.total_rejected).toBe(2);
    expect(summary.average_value).toBe(20);
    expect(summary.min_value).toBe(10);
    expect(summary.max_value).toBe(30);
  });

  it('should handle an empty stream cleanly', async () => {
    const summary = await runClient(`127.0.0.1:${boundPort}`, []);
    expect(summary.total_received).toBe(0);
    expect(summary.total_accepted).toBe(0);
    expect(summary.total_rejected).toBe(0);
  });
});
