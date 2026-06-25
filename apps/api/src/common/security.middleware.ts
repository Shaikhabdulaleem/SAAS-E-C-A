import { randomBytes, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';

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

const buckets = new Map<string, Bucket>();
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const defaultLimit = Number(process.env.RATE_LIMIT_MAX ?? 600);
const authLimit = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10);
const aiLimit = Number(process.env.AI_RATE_LIMIT_MAX ?? 60);

function keyFor(request: Request) {
  const userKey = request.headers.authorization ?? request.headers['x-tenant-id'] ?? '';
  return `${request.ip}:${userKey}:${request.method}:${request.path}`;
}

function limitFor(request: Request) {
  if (request.path.includes('/auth/login') || request.path.includes('/auth/password-reset')) return authLimit;
  if (request.path.includes('/ai/')) return aiLimit;
  return defaultLimit;
}

export function rateLimitMiddleware(request: Request, response: Response, next: NextFunction) {
  const now = Date.now();
  const key = keyFor(request);
  const limit = limitFor(request);
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);

  response.setHeader('X-RateLimit-Limit', String(limit));
  response.setHeader('X-RateLimit-Remaining', String(Math.max(limit - bucket.count, 0)));
  response.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > limit) {
    response.status(429).json({
      data: null,
      meta: {},
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' },
    });
    return;
  }

  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of buckets.entries()) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
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
    console.info(`${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms tenant=${tenantId}`);
  });
  next();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
