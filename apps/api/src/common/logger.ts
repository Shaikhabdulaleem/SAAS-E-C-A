const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel) {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'nexushq-api',
    pid: process.pid,
    ...context,
  };

  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry);
  }

  const prefix = `[${entry.timestamp}] ${level.toUpperCase().padEnd(5)}`;
  const ctx = context ? ` ${JSON.stringify(context)}` : '';
  return `${prefix} ${message}${ctx}`;
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    if (shouldLog('debug')) console.debug(formatEntry('debug', message, context));
  },
  info(message: string, context?: Record<string, unknown>) {
    if (shouldLog('info')) console.info(formatEntry('info', message, context));
  },
  warn(message: string, context?: Record<string, unknown>) {
    if (shouldLog('warn')) console.warn(formatEntry('warn', message, context));
  },
  error(message: string, context?: Record<string, unknown>) {
    if (shouldLog('error')) console.error(formatEntry('error', message, context));
  },
};
