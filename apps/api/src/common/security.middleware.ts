import { randomBytes, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from './logger';

export function helmetMiddleware(request: Request, response: Response, next: NextFunction) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-XSS-Protection', '0');
  response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.removeHeader('X-Powered-By');
  next();
}

type Bucket = {
  count: number;
  resetAt: number;
};

const localBuckets = new Map<string, Bucket>();
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const defaultLimit = Number(process.env.RATE_LIMIT_MAX ?? 600);
const authLimit = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10);
const aiLimit = Number(process.env.AI_RATE_LIMIT_MAX ?? 60);

let redisClient: { incr: (key: string) => Promise<number>; pexpire: (key: string, ms: number) => Promise<number>; pttl: (key: string) => Promise<number> } | null = null;

async function initRedisRateLimiter() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || redisClient) return;
  try {
    const IORedis = (await import('ioredis')).default;
    redisClient = new IORedis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true }) as never;
    await (redisClient as unknown as { connect: () => Promise<void> }).connect();
    logger.info('Rate limiter using Redis');
  } catch {
    redisClient = null;
    logger.warn('Rate limiter falling back to in-memory (Redis unavailable)');
  }
}
void initRedisRateLimiter();

function keyFor(request: Request) {
  const userKey = request.headers.authorization ?? request.headers['x-tenant-id'] ?? '';
  return `rl:${request.ip}:${userKey}:${request.method}:${request.path}`;
}

function limitFor(request: Request) {
  if (request.path.includes('/auth/login') || request.path.includes('/auth/password-reset')) return authLimit;
  if (request.path.includes('/ai/')) return aiLimit;
  return defaultLimit;
}

async function redisRateLimit(key: string, limit: number, response: Response): Promise<boolean> {
  if (!redisClient) return false;
  try {
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.pexpire(key, windowMs);
    const ttl = await redisClient.pttl(key);
    const resetAt = Math.ceil((Date.now() + Math.max(ttl, 0)) / 1000);

    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(limit - count, 0)));
    response.setHeader('X-RateLimit-Reset', String(resetAt));

    if (count > limit) {
      response.status(429).json({
        data: null,
        meta: {},
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
      });
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

function localRateLimit(key: string, limit: number, response: Response): boolean {
  const now = Date.now();
  const current = localBuckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  localBuckets.set(key, bucket);

  response.setHeader('X-RateLimit-Limit', String(limit));
  response.setHeader('X-RateLimit-Remaining', String(Math.max(limit - bucket.count, 0)));
  response.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > limit) {
    response.status(429).json({
      data: null,
      meta: {},
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
    });
    return true;
  }

  if (localBuckets.size > 10_000) {
    for (const [bucketKey, value] of localBuckets.entries()) {
      if (value.resetAt <= now) localBuckets.delete(bucketKey);
    }
  }
  return false;
}

export async function rateLimitMiddleware(request: Request, response: Response, next: NextFunction) {
  const key = keyFor(request);
  const limit = limitFor(request);

  const handled = await redisRateLimit(key, limit, response);
  if (!handled) {
    const blocked = localRateLimit(key, limit, response);
    if (blocked) return;
  } else if (response.headersSent) {
    return;
  }

  next();
}

export function csrfMiddleware(request: Request, response: Response, next: NextFunction) {
  if (request.method === 'GET' && request.path.endsWith('/auth/csrf-token')) {
    const token = randomBytes(32).toString('hex');
    response.cookie?.('nexushq_csrf', token, { sameSite: 'strict', httpOnly: false, secure: process.env.NODE_ENV === 'production' });
    response.json({ data: { csrfToken: token }, meta: {}, error: null });
    return;
  }

  const isStateChanging = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const usesCookieAuth = Boolean(request.headers.cookie);
  if (!isStateChanging || !usesCookieAuth) {
    next();
    return;
  }

  const cookieToken = request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('nexushq_csrf='))
    ?.split('=')[1];
  const headerToken = request.headers['x-csrf-token'];
  const headerValue = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  if (!cookieToken || !headerValue || !safeEqual(cookieToken, headerValue)) {
    response.status(403).json({
      data: null,
      meta: {},
      error: { code: 'CSRF_REQUIRED', message: 'CSRF token is required for cookie-authenticated writes.' },
    });
    return;
  }

  next();
}

export function requestLoggingMiddleware(request: Request, response: Response, next: NextFunction) {
  const startedAt = Date.now();
  response.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const tenantId = request.headers['x-tenant-id'] ?? '-';
    logger.info('request', { method: request.method, url: request.originalUrl, status: response.statusCode, durationMs, tenantId: tenantId as string });
  });
  next();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
