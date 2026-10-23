const { z } = require('zod');

const envSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(50051),
  HOST: z.string().default('127.0.0.1'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  JWT_SECRET: z.string().default('grpc-learning-demo-secret-key-32-chars!!'),
});

let cached = null;

function getEnv() {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    for (const [key, errors] of Object.entries(
      result.error.flatten().fieldErrors,
    )) {
      console.error(`  ${key}: ${errors?.join(', ')}`);
    }
    process.exit(1);
  }

  cached = result.data;
  return cached;
}

module.exports = {
  getEnv,
};
