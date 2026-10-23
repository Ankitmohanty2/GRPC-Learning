const grpc = require('@grpc/grpc-js');
const { loadProtoFile, resolveProtoPath } = require('../../../src/common/proto-loader');
const { createGrpcError } = require('../../../src/common/errors');
const { HealthImplementation } = require('../../../src/servers/health');
const { createLogger } = require('../../../src/config/logger');

const logger = createLogger('microservice-users');

class UserServiceManager {
  constructor() {
    this.users = new Map();
    this.emailIndex = new Map();

    this.create('Alice Customer', 'alice@customer.com');
    this.create('Bob Buyer', 'bob@buyer.com');
  }

  create(name, email) {
    const id = `usr_${Math.random().toString(36).substring(2, 9)}`;
    const user = {
      id,
      name,
      email: email.toLowerCase(),
      status: 'USER_STATUS_ACTIVE',
      created_at: { seconds: Math.floor(Date.now() / 1000), nanos: 0 },
    };
    this.users.set(id, user);
    this.emailIndex.set(user.email, id);
    return user;
  }

  getById(id) {
    return this.users.get(id);
  }

  list(pageSize = 10) {
    return Array.from(this.users.values()).slice(0, pageSize);
  }
}

const userManager = new UserServiceManager();
const healthService = new HealthImplementation();

function startUserService(port = 50051, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('users', 'v1', 'users.proto');
    const { grpcObject } = loadProtoFile(protoPath);

    const server = new grpc.Server();
    server.addService(grpcObject.users.v1.UserService.service, {
      getUser: (call, cb) => {
        const user = userManager.getById(call.request.id);
        if (!user) {
          return cb(createGrpcError(grpc.status.NOT_FOUND, `User ${call.request.id} not found`));
        }
        cb(null, { user });
      },
      createUser: (call, cb) => {
        const { name, email } = call.request;
        if (!name || !email) {
          return cb(createGrpcError(grpc.status.INVALID_ARGUMENT, 'Name and email required'));
        }
        if (userManager.emailIndex.has(email.toLowerCase())) {
          return cb(createGrpcError(grpc.status.ALREADY_EXISTS, 'Email already exists'));
        }
        const user = userManager.create(name, email);
        cb(null, { user });
      },
      listUsers: (call, cb) => {
        const size = call.request?.pagination?.page_size || 10;
        const users = userManager.list(size);
        cb(null, {
          users,
          pagination: { total_count: userManager.users.size },
        });
      },
    });

    healthService.addToServer(server);
    healthService.setStatus('users.v1.UserService', 'SERVING');

    server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) return reject(err);
      logger.info({ port: boundPort }, 'User Microservice running');
      resolve({ server, port: boundPort, userManager });
    });
  });
}

if (require.main === module) {
  const port = process.env.USER_SERVICE_PORT || 50051;
  startUserService(Number(port)).catch((err) => {
    logger.error({ err }, 'User service failed to start');
    process.exit(1);
  });
}

module.exports = {
  startUserService,
  userManager,
};
