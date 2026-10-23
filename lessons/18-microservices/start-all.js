const { startUserService } = require('./services/user-service');
const { startProductService } = require('./services/product-service');
const { startOrderService } = require('./services/order-service');

async function startAll() {
  console.log('\n🚀 Starting grpc-commerce-demo Microservices Cluster...');

  const user = await startUserService(50051);
  const product = await startProductService(50052);
  const order = await startOrderService(50053, '127.0.0.1', '127.0.0.1:50051', '127.0.0.1:50052');

  console.log(`✅ User Service:    127.0.0.1:${user.port}`);
  console.log(`✅ Product Service: 127.0.0.1:${product.port}`);
  console.log(`✅ Order Service:   127.0.0.1:${order.port}`);
  console.log('\nRun the demo client in another terminal:');
  console.log('  npm run microservices:client\n');

  const shutdown = async () => {
    console.log('\n🛑 Gracefully shutting down microservices cluster...');
    order.closeClients();
    await Promise.all([
      new Promise((r) => user.server.tryShutdown(r)),
      new Promise((r) => product.server.tryShutdown(r)),
      new Promise((r) => order.server.tryShutdown(r)),
    ]);
    console.log('✅ Cluster stopped cleanly.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  startAll().catch(console.error);
}

module.exports = {
  startAll,
};
