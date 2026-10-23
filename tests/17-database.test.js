const { startProductServer } = require('../lessons/17-database-integration/demo');
const { loadProtoFile, resolveProtoPath } = require('../src/common/proto-loader');
const grpc = require('@grpc/grpc-js');

describe('Lesson 17: Database Integration & Transactional Stock Reservation', () => {
  let serverInstance;
  let client;

  beforeAll(async () => {
    const result = await startProductServer();
    serverInstance = result.server;

    const protoPath = resolveProtoPath('products', 'v1', 'products.proto');
    const { grpcObject } = loadProtoFile(protoPath);
    client = new grpcObject.products.v1.ProductService(
      `127.0.0.1:${result.port}`,
      grpc.credentials.createInsecure(),
    );
  });

  afterAll(async () => {
    client.close();
    await new Promise((r) => serverInstance.tryShutdown(r));
  });

  it('should successfully reserve available stock', async () => {
    const res = await new Promise((resolve, reject) => {
      client.checkAndReserveStock(
        { product_id: 'prod_laptop', quantity: 3 },
        (err, r) => (err ? reject(err) : resolve(r)),
      );
    });

    expect(res.success).toBe(true);
    expect(res.remaining_stock).toBe(7);
  });

  it('should reject reservation when quantity exceeds remaining stock', async () => {
    const res = await new Promise((resolve, reject) => {
      client.checkAndReserveStock(
        { product_id: 'prod_laptop', quantity: 999 },
        (err, r) => (err ? reject(err) : resolve(r)),
      );
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain('Insufficient inventory');
  });

  it('should return NOT_FOUND when product does not exist', async () => {
    await expect(
      new Promise((resolve, reject) => {
        client.checkAndReserveStock(
          { product_id: 'non_existent_prod', quantity: 1 },
          (err, r) => (err ? reject(err) : resolve(r)),
        );
      }),
    ).rejects.toMatchObject({
      code: grpc.status.NOT_FOUND,
    });
  });
});
