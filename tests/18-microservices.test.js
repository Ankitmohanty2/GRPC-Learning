const grpc = require('@grpc/grpc-js');
const { startUserService } = require('../lessons/18-microservices/services/user-service');
const { startProductService } = require('../lessons/18-microservices/services/product-service');
const { startOrderService } = require('../lessons/18-microservices/services/order-service');
const { loadProtoFile, resolveProtoPath } = require('../src/common/proto-loader');

describe('Lesson 18: Integrated Microservices Demo (grpc-commerce-demo)', () => {
  let userApp;
  let productApp;
  let orderApp;
  let orderClient;
  let userClient;

  beforeAll(async () => {
    userApp = await startUserService(0, '127.0.0.1');
    productApp = await startProductService(0, '127.0.0.1');
    orderApp = await startOrderService(
      0,
      '127.0.0.1',
      `127.0.0.1:${userApp.port}`,
      `127.0.0.1:${productApp.port}`,
    );

    const orderProto = loadProtoFile(resolveProtoPath('orders', 'v1', 'orders.proto')).grpcObject;
    orderClient = new orderProto.orders.v1.OrderService(
      `127.0.0.1:${orderApp.port}`,
      grpc.credentials.createInsecure(),
    );

    const userProto = loadProtoFile(resolveProtoPath('users', 'v1', 'users.proto')).grpcObject;
    userClient = new userProto.users.v1.UserService(
      `127.0.0.1:${userApp.port}`,
      grpc.credentials.createInsecure(),
    );
  });

  afterAll(async () => {
    orderClient.close();
    userClient.close();
    orderApp.closeClients();
    await Promise.all([
      new Promise((r) => userApp.server.tryShutdown(r)),
      new Promise((r) => productApp.server.tryShutdown(r)),
      new Promise((r) => orderApp.server.tryShutdown(r)),
    ]);
  });

  it('should successfully place an order through User and Product service orchestration', async () => {
    const userRes = await new Promise((res, rej) =>
      userClient.createUser({ name: 'Sam Buyer', email: 'sam@buyer.com' }, (err, r) => err ? rej(err) : res(r)),
    );

    const orderRes = await new Promise((res, rej) => {
      orderClient.createOrder(
        {
          user_id: userRes.user.id,
          items: [{ product_id: 'prod_keyboard', quantity: 1 }],
          idempotency_key: 'idem_key_1',
        },
        (err, r) => (err ? rej(err) : res(r)),
      );
    });

    expect(orderRes.order.id).toBeDefined();
    expect(orderRes.order.user_id).toBe(userRes.user.id);
    expect(orderRes.order.total_amount).toBe(120.0);
    expect(orderRes.order.status).toBe('ORDER_STATUS_PAID');
  });

  it('should return identical order when replaying same idempotency key', async () => {
    const duplicateRes = await new Promise((res, rej) => {
      orderClient.createOrder(
        {
          user_id: 'some_user',
          items: [{ product_id: 'prod_keyboard', quantity: 1 }],
          idempotency_key: 'idem_key_1',
        },
        (err, r) => (err ? rej(err) : res(r)),
      );
    });

    expect(duplicateRes.order.total_amount).toBe(120.0);
  });

  it('should reject order if user does not exist in User service', async () => {
    await expect(
      new Promise((res, rej) => {
        orderClient.createOrder(
          {
            user_id: 'non_existent_user_id',
            items: [{ product_id: 'prod_keyboard', quantity: 1 }],
            idempotency_key: 'idem_key_fail',
          },
          (err, r) => (err ? rej(err) : res(r)),
        );
      }),
    ).rejects.toMatchObject({
      code: grpc.status.FAILED_PRECONDITION,
    });
  });

  it('should reject order if product stock is insufficient', async () => {
    const userRes = await new Promise((res, rej) =>
      userClient.listUsers({ pagination: { page_size: 1 } }, (err, r) => err ? rej(err) : res(r)),
    );

    await expect(
      new Promise((res, rej) => {
        orderClient.createOrder(
          {
            user_id: userRes.users[0].id,
            items: [{ product_id: 'prod_mouse', quantity: 999 }],
            idempotency_key: 'idem_key_out_of_stock',
          },
          (err, r) => (err ? rej(err) : res(r)),
        );
      }),
    ).rejects.toMatchObject({
      code: grpc.status.RESOURCE_EXHAUSTED,
    });
  });
});
