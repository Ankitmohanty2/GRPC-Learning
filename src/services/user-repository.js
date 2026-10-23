const { z } = require('zod');

const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
});

const GetUserSchema = z.object({
  id: z.string().min(1),
});

const ListUsersSchema = z.object({
  page_size: z.coerce.number().int().min(1).max(100).default(10),
  page_token: z.string().optional().default(''),
});

class UserRepository {
  constructor(initialUsers = []) {
    this.users = new Map();
    this.emailIndex = new Map();
    for (const user of initialUsers) {
      this.users.set(user.id, user);
      this.emailIndex.set(user.email.toLowerCase(), user.id);
    }
  }

  getById(id) {
    return this.users.get(id);
  }

  getByEmail(email) {
    const id = this.emailIndex.get(email.toLowerCase());
    return id ? this.users.get(id) : undefined;
  }

  create(name, email) {
    const id = `usr_${Math.random().toString(36).substring(2, 9)}`;
    const now = { seconds: Math.floor(Date.now() / 1000), nanos: 0 };
    const user = {
      id,
      name,
      email: email.toLowerCase(),
      status: 'USER_STATUS_ACTIVE',
      created_at: now,
      updated_at: now,
    };

    this.users.set(id, user);
    this.emailIndex.set(user.email, id);
    return user;
  }

  list(pageSize, pageToken) {
    const allUsers = Array.from(this.users.values());
    const startIndex = pageToken
      ? parseInt(Buffer.from(pageToken, 'base64').toString('ascii'), 10) || 0
      : 0;
    const paginated = allUsers.slice(startIndex, startIndex + pageSize);
    const nextOffset = startIndex + pageSize;
    const nextPageToken =
      nextOffset < allUsers.length
        ? Buffer.from(String(nextOffset)).toString('base64')
        : '';

    return {
      users: paginated,
      nextPageToken,
      totalCount: allUsers.length,
    };
  }

  clear() {
    this.users.clear();
    this.emailIndex.clear();
  }
}

const sharedUserRepository = new UserRepository([
  {
    id: 'usr_seed1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    status: 'USER_STATUS_ACTIVE',
    created_at: { seconds: 1700000000, nanos: 0 },
    updated_at: { seconds: 1700000000, nanos: 0 },
  },
  {
    id: 'usr_seed2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    status: 'USER_STATUS_ACTIVE',
    created_at: { seconds: 1700000500, nanos: 0 },
    updated_at: { seconds: 1700000500, nanos: 0 },
  },
]);

module.exports = {
  CreateUserSchema,
  GetUserSchema,
  ListUsersSchema,
  UserRepository,
  sharedUserRepository,
};
