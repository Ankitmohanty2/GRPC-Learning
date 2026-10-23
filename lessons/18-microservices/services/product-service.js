const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../../src/common/proto-loader');
const { createGrpcError } = require('../../../src/common/errors');
const { HealthImplementation } = require('../../../src/servers/health');
const { createLogger } = require('../../../src/config/logger');

const logger = createLogger('microservice-products');

class ProductServiceManager {
  constructor() {
    this.products = new Map();

    this.products.set('prod_keyboard', {
      id: 'prod_keyboard',
      name: 'Mechanical Keyboard',
      description: 'Hot-swappable RGB keyboard',
      price: 120.0,
      stock_quantity: 15,
      created_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      updated_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    });

    this.products.set('prod_mouse', {
      id: 'prod_mouse',
      name: 'Wireless Ergonomic Mouse',
      description: '4000 DPI sensor',
      price: 80.0,
      stock_quantity: 2,
      created_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      updated_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    });
  }

  getById(id) {
    return this.products.get(id);
  }

  create(name, description, price, stockQuantity) {
    const id = `prod_${Math.random().toString(36).substring(2, 9)}`;
    const product = {
      id,
      name,
      description,
      price,
      stock_quantity: stockQuantity,
      created_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
      updated_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    };
    this.products.set(id, product);
    return product;
  }

  checkAndReserveStock(productId, quantity) {
    const product = this.products.get(productId);
    if (!product) {
      throw createGrpcError(grpc.status.NOT_FOUND, `Product ${productId} not found`);
    }

    if (product.stock_quantity < quantity) {
      return {
        success: false,
        message: `Insufficient inventory for ${product.name}: requested ${quantity}, available ${product.stock_quantity}`,
        remaining_stock: product.stock_quantity,
      };
    }

    product.stock_quantity -= quantity;
    return {
      success: true,
      message: 'Stock reserved successfully',
      remaining_stock: product.stock_quantity,
    };
  }

  list() {
    return Array.from(this.products.values());
  }
}

const productManager = new ProductServiceManager();
const healthService = new HealthImplementation();

function startProductService(port = 50052, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('products', 'v1', 'products.proto');
    const { grpcObject } = loadProtoFile(protoPath);

    const server = new grpc.Server();
    server.addService(grpcObject.products.v1.ProductService.service, {
      getProduct: (call, cb) => {
        const product = productManager.getById(call.request.id);
        if (!product) {
          return cb(createGrpcError(grpc.status.NOT_FOUND, 'Product not found'));
        }
        cb(null, { product });
      },
      createProduct: (call, cb) => {
        const { name, description, price, stock_quantity } = call.request;
        const product = productManager.create(name, description, price, stock_quantity);
        cb(null, { product });
      },
      listProducts: (_call, cb) => {
        cb(null, {
          products: productManager.list(),
          pagination: { total_count: productManager.products.size },
        });
      },
      checkAndReserveStock: (call, cb) => {
        try {
          const res = productManager.checkAndReserveStock(
            call.request.product_id,
            call.request.quantity,
          );
          cb(null, res);
        } catch (err) {
          cb(err);
        }
      },
    });

    healthService.addToServer(server);
    healthService.setStatus('products.v1.ProductService', 'SERVING');

    server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      logger.info({ port: boundPort }, 'Product Microservice running');
      resolve({ server, port: boundPort, productManager });
    });
  });
}

if (require.main === module) {
  const port = process.env.PRODUCT_SERVICE_PORT || 50052;
  startProductService(Number(port)).catch((err) => {
    logger.error({ err }, 'Product service failed to start');
    process.exit(1);
  });
}

module.exports = {
  startProductService,
  productManager,
};
