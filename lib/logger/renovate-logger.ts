import is from '@sindresorhus/is';
import type * as bunyan from 'bunyan';
import { once, reset as onceReset } from './once';
import { getRemappedLevel } from './remap';
import type { Logger } from './types';
import { getMessage, toMeta, withSanitizer } from './utils';

const loggerLevels: bunyan.LogLevelString[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
];

type LoggerFunction = (p1: string | Record<string, any>, p2?: string) => void;

export class RenovateLogger implements Logger {
  readonly logger: Logger = { once: { reset: onceReset } } as any;
  readonly once = this.logger.once;

  constructor(
    private readonly bunyanLogger: bunyan,
    private context: string,
    private meta: Record<string, unknown>,
  ) {
    for (const level of loggerLevels) {
      this.logger[level] = this.logFactory(level) as never;
      this.logger.once[level] = this.logOnceFn(level);
    }
  }

  trace(p1: string): void;
  trace(p1: Record<string, any>, p2?: string): void;
  trace(p1: string | Record<string, any>, p2?: string): void {
    this.log('trace', p1, p2);
  }

  debug(p1: string): void;
  debug(p1: Record<string, any>, p2?: string): void;
  debug(p1: string | Record<string, any>, p2?: string): void {
    this.log('debug', p1, p2);
  }

  info(p1: string): void;
  info(p1: Record<string, any>, p2?: string): void;
  info(p1: string | Record<string, any>, p2?: string): void {
    this.log('info', p1, p2);
  }

  warn(p1: string): void;
  warn(p1: Record<string, any>, p2?: string): void;
  warn(p1: string | Record<string, any>, p2?: string): void {
    this.log('warn', p1, p2);
  }

  error(p1: string): void;
  error(p1: Record<string, any>, p2?: string): void;
  error(p1: string | Record<string, any>, p2?: string): void {
    this.log('error', p1, p2);
  }

  fatal(p1: string): void;
  fatal(p1: Record<string, any>, p2?: string): void;
  fatal(p1: string | Record<string, any>, p2?: string): void {
    this.log('fatal', p1, p2);
  }

  addStream(stream: bunyan.Stream): void {
    this.bunyanLogger.addStream(withSanitizer(stream));
  }

  childLogger(): RenovateLogger {
    return new RenovateLogger(
      this.bunyanLogger.child({}),
      this.context,
      this.meta,
    );
  }

  get logContext(): string {
    return this.context;
  }

  set logContext(context: string) {
    this.context = context;
  }

  setMeta(obj: Record<string, unknown>): void {
    this.meta = { ...obj };
  }

  addMeta(obj: Record<string, unknown>): void {
    this.meta = { ...this.meta, ...obj };
  }

  removeMeta(fields: string[]): void {
    for (const key of Object.keys(this.meta)) {
      if (fields.includes(key)) {
        delete this.meta[key];
      }
    }
  }

  private logFactory(_level: bunyan.LogLevelString): LoggerFunction {
    return (p1: string | Record<string, any>, p2?: string): void => {
      const meta: Record<string, unknown> = {
        logContext: this.context,
        ...this.meta,
        ...toMeta(p1),
      };
      const msg = getMessage(p1, p2);
      let level = _level;

      if (is.string(msg)) {
        const remappedLevel = getRemappedLevel(msg);
        /* v8 ignore next 4 -- not easily testable */
        if (remappedLevel) {
          meta.oldLevel = level;
          level = remappedLevel;
        }
        this.bunyanLogger[level](meta, msg);
      } else {
        this.bunyanLogger[level](meta);
      }
    };
  }

  private logOnceFn(level: bunyan.LogLevelString): LoggerFunction {
    const logOnceFn = (p1: string | Record<string, any>, p2?: string): void => {
      once(() => {
        const logFn = this[level].bind(this); // bind to the instance.
        if (is.string(p1)) {
          logFn(p1);
        } else {
          logFn(p1, p2);
        }
      }, logOnceFn);
    };
    return logOnceFn;
  }

  private log(
    level: bunyan.LogLevelString,
    p1: string | Record<string, any>,
    p2?: string,
  ): void {
    const logFn = this.logger[level];
    if (is.string(p1)) {
      logFn(p1);
    } else {
      logFn(p1, p2);
    }
  }
}
