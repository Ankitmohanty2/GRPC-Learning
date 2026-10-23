const pino = require('pino');
const { getEnv } = require('./env');

function createLogger(name) {
  const env = getEnv();

  return pino({
    name,
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
}

module.exports = {
  createLogger,
};
