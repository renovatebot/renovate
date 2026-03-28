import type { Logger } from './types.ts';

type LogFn = (p1: string | Record<string, any>, p2?: string) => void;

function logFactory(
  consoleFn: (...args: unknown[]) => void,
  level: string,
): LogFn {
  return (p1: string | Record<string, any>, p2?: string): void => {
    if (typeof p1 === 'string') {
      consoleFn(`[${level}]`, p1);
    } else {
      consoleFn(`[${level}]`, p2 ?? '', p1);
    }
  };
}

function createLogger(): Logger {
  const onceBase = {
    trace: logFactory(console.debug, 'trace'),
    debug: logFactory(console.debug, 'debug'),
    info: logFactory(console.info, 'info'),
    warn: logFactory(console.warn, 'warn'),
    error: logFactory(console.error, 'error'),
    fatal: logFactory(console.error, 'fatal'),
    reset: () => {
      // noop
    },
  };
  const once = onceBase as Logger & { reset: () => void };
  once.once = once;

  const instance: Logger = {
    trace: logFactory(console.debug, 'trace'),
    debug: logFactory(console.debug, 'debug'),
    info: logFactory(console.info, 'info'),
    warn: logFactory(console.warn, 'warn'),
    error: logFactory(console.error, 'error'),
    fatal: logFactory(console.error, 'fatal'),
    once,
  };

  return instance;
}

export const logger: Logger = createLogger();
