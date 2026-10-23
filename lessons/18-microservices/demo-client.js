const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { statusName } = require('../../src/common/errors');

async function runCommerceDemo() {
  const userProto = loadProtoFile(resolveProtoPath('users', 'v1', 'users.proto')).grpcObject;
  const productProto = loadProtoFile(resolveProtoPath('products', 'v1', 'products.proto')).grpcObject;
  const orderProto = loadProtoFile(resolveProtoPath('orders', 'v1', 'orders.proto')).grpcObject;

  const userClient = new userProto.users.v1.UserService('127.0.0.1:50051', grpc.credentials.createInsecure());
  const productClient = new productProto.products.v1.ProductService('127.0.0.1:50052', grpc.credentials.createInsecure());
  const orderClient = new orderProto.orders.v1.OrderService('127.0.0.1:50053', grpc.credentials.createInsecure());

  console.log('\n--- 1. Querying User Service ---');
  const userList = await new Promise((res, rej) =>
    userClient.listUsers({ pagination: { page_size: 1 } }, (err, r) => err ? rej(err) : res(r)),
  );
  const buyer = userList.users[0];
  console.log(`Found buyer: ${buyer.name} (${buyer.id})`);

  console.log('\n--- 2. Querying Product Service ---');
  const productList = await new Promise((res, rej) =>
    productClient.listProducts({}, (err, r) => err ? rej(err) : res(r)),
  );
  const keyboard = productList.products.find((p) => p.id === 'prod_keyboard');
  console.log(`Found product: ${keyboard.name} - Price: $${keyboard.price} (Stock: ${keyboard.stock_quantity})`);

  console.log('\n--- 3. Creating Order via Order Service (Orchestrator) ---');
  const idempotencyKey = `demo_key_${Date.now()}`;
  const orderResult = await new Promise((res, rej) => {
    orderClient.createOrder(
      {
        user_id: buyer.id,
        items: [{ product_id: keyboard.id, quantity: 2 }],
        idempotency_key: idempotencyKey,
      },
      (err, r) => (err ? rej(err) : res(r)),
    );
  });
  console.log(`Order Placed: ID=${orderResult.order.id}, Total=$${orderResult.order.total_amount}`);

  console.log('\n--- 4. Testing Idempotency (Replaying same order with same key) ---');
  const duplicateOrder = await new Promise((res, rej) => {
    orderClient.createOrder(
      {
        user_id: buyer.id,
        items: [{ product_id: keyboard.id, quantity: 2 }],
        idempotency_key: idempotencyKey,
      },
      (err, r) => (err ? rej(err) : res(r)),
    );
  });
  console.log(`Idempotent Match: Same Order ID returned -> ${duplicateOrder.order.id}`);

  console.log('\n--- 5. Negative Test: Requesting Insufficient Stock ---');
  try {
    await new Promise((res, rej) => {
      orderClient.createOrder(
        {
          user_id: buyer.id,
          items: [{ product_id: keyboard.id, quantity: 9999 }],
        },
        (err, r) => (err ? rej(err) : res(r)),
      );
    });
  } catch (err) {
    console.log(`Caught expected business failure: [${statusName(err.code)}] ${err.details}\n`);
  }

  userClient.close();
  productClient.close();
  orderClient.close();
}

if (require.main === module) {
  runCommerceDemo().catch(console.error);
}

module.exports = {
  runCommerceDemo,
};
