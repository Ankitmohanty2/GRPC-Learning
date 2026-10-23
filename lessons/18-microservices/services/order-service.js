const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../../src/common/proto-loader');
const { createGrpcError } = require('../../../src/common/errors');
const { HealthImplementation } = require('../../../src/servers/health');
const { createLogger } = require('../../../src/config/logger');

const logger = createLogger('microservice-orders');

class OrderServiceManager {
  constructor() {
    this.orders = new Map();
    this.idempotencyMap = new Map();
  }

  saveOrder(order, idempotencyKey) {
    this.orders.set(order.id, order);
    if (idempotencyKey) {
      this.idempotencyMap.set(idempotencyKey, order);
    }
    return order;
  }

  getById(id) {
    return this.orders.get(id);
  }

  listByUser(userId) {
    return Array.from(this.orders.values()).filter((o) => o.user_id === userId);
  }
}

const orderManager = new OrderServiceManager();
const healthService = new HealthImplementation();

function startOrderService(
  port = 50053,
  host = '127.0.0.1',
  userTarget = '127.0.0.1:50051',
  productTarget = '127.0.0.1:50052',
) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('orders', 'v1', 'orders.proto');
    const { grpcObject } = loadProtoFile(protoPath);

    const userProto = loadProtoFile(resolveProtoPath('users', 'v1', 'users.proto')).grpcObject;
    const userClient = new userProto.users.v1.UserService(userTarget, grpc.credentials.createInsecure());

    const productProto = loadProtoFile(resolveProtoPath('products', 'v1', 'products.proto')).grpcObject;
    const productClient = new productProto.products.v1.ProductService(productTarget, grpc.credentials.createInsecure());

    const server = new grpc.Server();
    server.addService(grpcObject.orders.v1.OrderService.service, {
      createOrder: async (call, cb) => {
        const { user_id, items, idempotency_key } = call.request;

        if (idempotency_key && orderManager.idempotencyMap.has(idempotency_key)) {
          logger.info({ idempotency_key }, 'Returning previously processed idempotent order');
          return cb(null, { order: orderManager.idempotencyMap.get(idempotency_key) });
        }

        const deadline = call.getDeadline();

        try {
          await new Promise((res, rej) => {
            userClient.getUser({ id: user_id }, { deadline }, (err, response) => {
              if (err) return rej(err);
              res(response.user);
            });
          });
        } catch (err) {
          logger.warn({ user_id, err: err.message }, 'Failed to verify user from User microservice');
          return cb(createGrpcError(grpc.status.FAILED_PRECONDITION, `User validation failed: ${err.details || err.message}`));
        }

        let totalAmount = 0;
        const confirmedItems = [];

        for (const item of items) {
          try {
            const reservation = await new Promise((res, rej) => {
              productClient.checkAndReserveStock(
                { product_id: item.product_id, quantity: item.quantity },
                { deadline },
                (err, response) => (err ? rej(err) : res(response)),
              );
            });

            if (!reservation.success) {
              return cb(createGrpcError(grpc.status.RESOURCE_EXHAUSTED, reservation.message));
            }

            const productInfo = await new Promise((res, rej) => {
              productClient.getProduct({ id: item.product_id }, { deadline }, (err, response) =>
                err ? rej(err) : res(response.product),
              );
            });

            const unitPrice = productInfo.price;
            totalAmount += unitPrice * item.quantity;
            confirmedItems.push({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: unitPrice,
            });
          } catch (err) {
            return cb(createGrpcError(grpc.status.FAILED_PRECONDITION, `Product stock reservation failed: ${err.details || err.message}`));
          }
        }

        const order = {
          id: `ord_${Math.random().toString(36).substring(2, 9)}`,
          user_id,
          items: confirmedItems,
          total_amount: Number(totalAmount.toFixed(2)),
          status: 'ORDER_STATUS_PAID',
          created_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
        };

        orderManager.saveOrder(order, idempotency_key);
        logger.info({ orderId: order.id, totalAmount: order.total_amount }, 'Order created successfully');
        cb(null, { order });
      },
      getOrder: (call, cb) => {
        const order = orderManager.getById(call.request.id);
        if (!order) {
          return cb(createGrpcError(grpc.status.NOT_FOUND, `Order ${call.request.id} not found`));
        }
        cb(null, { order });
      },
      listOrders: (call, cb) => {
        const orders = orderManager.listByUser(call.request.user_id);
        cb(null, {
          orders,
          pagination: { total_count: orders.length },
        });
      },
    });

    healthService.addToServer(server);
    healthService.setStatus('orders.v1.OrderService', 'SERVING');

    server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      logger.info({ port: boundPort }, 'Order Microservice running');
      resolve({
        server,
        port: boundPort,
        orderManager,
        closeClients: () => {
          userClient.close();
          productClient.close();
        },
      });
    });
  });
}

if (require.main === module) {
  const port = process.env.ORDER_SERVICE_PORT || 50053;
  const userTarget = process.env.USER_SERVICE_TARGET || '127.0.0.1:50051';
  const productTarget = process.env.PRODUCT_SERVICE_TARGET || '127.0.0.1:50052';
  startOrderService(Number(port), '127.0.0.1', userTarget, productTarget).catch((err) => {
    logger.error({ err }, 'Order service failed to start');
    process.exit(1);
  });
}

module.exports = {
  startOrderService,
  orderManager,
};
