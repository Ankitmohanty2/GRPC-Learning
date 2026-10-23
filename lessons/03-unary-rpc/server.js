const grpc = require('@grpc/grpc-js');
const { ReflectionService } = require('@grpc/reflection');
const { loadProtoFile, resolveProtoPath } = require('../../src/common/proto-loader');
const { createGrpcError } = require('../../src/common/errors');
const { createLogger } = require('../../src/config/logger');
const { getEnv } = require('../../src/config/env');
const {
  sharedUserRepository,
  CreateUserSchema,
  GetUserSchema,
  ListUsersSchema,
} = require('../../src/services/user-repository');

const logger = createLogger('03-unary-server');
const env = getEnv();

function getUser(call, callback) {
  const parsed = GetUserSchema.safeParse(call.request);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message || 'Invalid request';
    return callback(createGrpcError(grpc.status.INVALID_ARGUMENT, issue));
  }

  const user = sharedUserRepository.getById(parsed.data.id);
  if (!user) {
    logger.warn({ id: parsed.data.id }, 'User not found');
    return callback(
      createGrpcError(grpc.status.NOT_FOUND, `User with ID ${parsed.data.id} not found`),
    );
  }

  logger.info({ id: user.id }, 'User retrieved successfully');
  callback(null, { user });
}

function createUser(call, callback) {
  const parsed = CreateUserSchema.safeParse(call.request);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message || 'Validation failed';
    return callback(createGrpcError(grpc.status.INVALID_ARGUMENT, issue));
  }

  const { name, email } = parsed.data;
  if (sharedUserRepository.getByEmail(email)) {
    logger.warn({ email }, 'User with email already exists');
    return callback(
      createGrpcError(grpc.status.ALREADY_EXISTS, `Email ${email} is already registered`),
    );
  }

  const newUser = sharedUserRepository.create(name, email);
  logger.info({ id: newUser.id, email: newUser.email }, 'User created successfully');
  callback(null, { user: newUser });
}

function listUsers(call, callback) {
  const paginationReq = call.request?.pagination || {};
  const parsed = ListUsersSchema.safeParse({
    page_size: paginationReq.page_size || 10,
    page_token: paginationReq.page_token || '',
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message || 'Invalid pagination parameter';
    return callback(createGrpcError(grpc.status.INVALID_ARGUMENT, issue));
  }

  const result = sharedUserRepository.list(parsed.data.page_size, parsed.data.page_token);
  callback(null, {
    users: result.users,
    pagination: {
      next_page_token: result.nextPageToken,
      total_count: result.totalCount,
    },
  });
}

function startServer(port = env.PORT + 2, host = env.HOST) {
  return new Promise((resolve, reject) => {
    const protoPath = resolveProtoPath('users', 'v1', 'users.proto');
    const { grpcObject, packageDefinition } = loadProtoFile(protoPath);

    const usersPkg = grpcObject.users?.v1;
    if (!usersPkg?.UserService?.service) {
      throw new Error('UserService not found in users.proto');
    }

    const server = new grpc.Server();
    server.addService(usersPkg.UserService.service, {
      getUser,
      createUser,
      listUsers,
    });

    const reflection = new ReflectionService(packageDefinition);
    reflection.addToServer(server);

    const address = `${host}:${port}`;
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        logger.error({ err, address }, 'Failed to bind UserService server');
        return reject(err);
      }
      logger.info({ address: `${host}:${boundPort}` }, 'gRPC UserService Unary server running');
      resolve({ server, port: boundPort });
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err }, 'Server fatal error');
    process.exit(1);
  });
}

module.exports = {
  startServer,
};
