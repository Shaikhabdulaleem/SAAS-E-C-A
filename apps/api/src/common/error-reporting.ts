import { logger } from './logger';

let sentryModule: { captureException: (err: unknown, ctx?: Record<string, unknown>) => void } | null = null;

export async function initErrorReporting() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry DSN not configured — error reporting disabled');
    return;
  }

  try {
    const sentryPkg = '@sentry/node';
    const Sentry: any = await import(sentryPkg).catch(() => null);
    if (!Sentry) {
      logger.warn('Sentry SDK not installed — run: npm i @sentry/node');
      return;
    }
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      release: process.env.APP_VERSION ?? 'unknown',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    sentryModule = Sentry;
    logger.info('Sentry error reporting initialized');
  } catch {
    logger.warn('Sentry initialization failed');
  }
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (sentryModule) {
    sentryModule.captureException(error, context ? { extra: context } as never : undefined);
  }
}
