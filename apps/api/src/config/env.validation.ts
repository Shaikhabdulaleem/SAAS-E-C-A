type Environment = Record<string, string | undefined>;

const requiredKeys = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'CORS_ORIGINS',
  'NODE_ENV',
] as const;

export function validateEnvironment(config: Environment) {
  const missing = requiredKeys.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const nodeEnv = config.NODE_ENV;
  if (!['development', 'test', 'production'].includes(nodeEnv ?? '')) {
    throw new Error('NODE_ENV must be one of: development, test, production');
  }

  const port = config.PORT ? Number(config.PORT) : 3001;
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return {
    ...config,
    PORT: port,
  };
}
