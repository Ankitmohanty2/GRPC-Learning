const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createGrpcError } = require('../../src/common/errors');
const { createLogger } = require('../../src/config/logger');

const logger = createLogger('17-db-integration');

class TransactionalProductRepository {
  constructor() {
    this.products = new Map();
    this.products.set('prod_laptop', {
      id: 'prod_laptop',
      name: 'Dev Laptop',
      price: 1299.99,
      stock_quantity: 10,
    });
  }

  async checkAndReserveStock(productId, quantity) {
    const product = this.products.get(productId);
    if (!product) {
      throw createGrpcError(grpc.status.NOT_FOUND, `Product ${productId} not found`);
    }

    if (product.stock_quantity < quantity) {
      return {
        success: false,
        message: `Insufficient inventory: requested ${quantity}, available ${product.stock_quantity}`,
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

  getProduct(id) {
    return this.products.get(id);
  }
}

const productRepo = new TransactionalProductRepository();

function startProductServer(port = 0) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('products', 'v1', 'products.proto');
    const { grpcObject } = loadProtoFile(protoPath);

    const server = new grpc.Server();
    server.addService(grpcObject.products.v1.ProductService.service, {
      getProduct: (call, cb) => {
        const product = productRepo.getProduct(call.request.id);
        if (!product) {
          return cb(createGrpcError(grpc.status.NOT_FOUND, 'Product not found'));
        }
        cb(null, { product });
      },
      createProduct: (call, cb) => {
        const id = `prod_${Date.now()}`;
        const newProd = { id, ...call.request };
        productRepo.products.set(id, newProd);
        cb(null, { product: newProd });
      },
      listProducts: (_call, cb) => {
        cb(null, { products: Array.from(productRepo.products.values()) });
      },
      checkAndReserveStock: async (call, cb) => {
        try {
          const res = await productRepo.checkAndReserveStock(
            call.request.product_id,
            call.request.quantity,
          );
          cb(null, res);
        } catch (err) {
          cb(err);
        }
      },
    });

    server.bindAsync('127.0.0.1:' + port, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      logger.info({ port: boundPort }, 'Transactional Product gRPC Service running');
      resolve({ server, port: boundPort, productRepo });
    });
  });
}

if (require.main === module) {
  startProductServer().then(({ port }) => {
    console.log(`Database-backed gRPC Product Service running on port ${port}`);
  });
}

module.exports = {
  TransactionalProductRepository,
  productRepo,
  startProductServer,
};
