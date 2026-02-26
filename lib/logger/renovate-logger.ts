import { isString } from '@sindresorhus/is';
import { LOGGER_NOT_INITIALIZED } from '../constants/error-messages.ts';
import { once, reset as onceReset } from './once.ts';
import { getRemappedLevel } from './remap.ts';
import type {
  BunyanLogLevel,
  BunyanLogger,
  BunyanSerializers,
  BunyanStream,
  Logger,
} from './types.ts';
import { getMessage, toMeta } from './utils.ts';
import { withSanitizer } from './with-sanitizer.ts';

const loggerLevels: BunyanLogLevel[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
];

type LoggerFunction = (p1: string | Record<string, any>, p2?: string) => void;

export class RenovateLogger implements Logger {
  private readonly queue: (() => void)[] = [];
  readonly logger: Logger = { once: { reset: onceReset } } as any;
  readonly once = this.logger.once;
  private bunyanLogger: BunyanLogger | undefined;
  private context: string;
  private meta: Record<string, unknown>;

  constructor(
    context: string,
    meta: Record<string, unknown>,
    bunyanLogger?: BunyanLogger,
  ) {
    this.bunyanLogger = bunyanLogger;
    this.context = context;
    this.meta = meta;
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

  addSerializers(serializers: BunyanSerializers): void {
    this.ensureLogger().addSerializers(serializers);
  }

  addStream(stream: BunyanStream): void {
    this.ensureLogger().addStream(withSanitizer(stream));
  }

  childLogger(): RenovateLogger {
    return new RenovateLogger(
      this.context,
      this.meta,
      this.ensureLogger().child({}),
    );
  }

  levels(name: 'stdout' | 'logfile', level: BunyanLogLevel): void {
    this.ensureLogger().levels(name, level);
  }

  get logContext(): string {
    return this.context;
  }

  set logContext(context: string) {
    this.context = context;
  }

  /**
   * For internal initialization only
   */
  set bunyan(bunyanLogger: BunyanLogger) {
    this.bunyanLogger = bunyanLogger;
    // flush any logs that were queued before bunyan logger was initialized
    for (const logFn of this.queue) {
      logFn();
    }
    this.queue.length = 0;
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

  private ensureLogger(): BunyanLogger {
    if (!this.bunyanLogger) {
      throw new Error(LOGGER_NOT_INITIALIZED);
    }
    return this.bunyanLogger;
  }

  private logFactory(_level: BunyanLogLevel): LoggerFunction {
    return (p1: string | Record<string, any>, p2?: string): void => {
      const meta: Record<string, unknown> = {
        logContext: this.context,
        ...this.meta,
        ...toMeta(p1),
      };
      const msg = getMessage(p1, p2);
      let level = _level;

      if (isString(msg)) {
        const remappedLevel = getRemappedLevel(msg);
        /* v8 ignore next 4 -- not easily testable */
        if (remappedLevel) {
          meta.oldLevel = level;
          level = remappedLevel;
        }
        this.ensureLogger()[level](meta, msg);
      } else {
        this.ensureLogger()[level](meta);
      }
    };
  }

  private logOnceFn(level: BunyanLogLevel): LoggerFunction {
    const logOnceFn = (p1: string | Record<string, any>, p2?: string): void => {
      once(
        () => {
          const logFn = this[level].bind(this); // bind to the instance.
          if (isString(p1)) {
            logFn(p1);
          } else {
            logFn(p1, p2);
          }
        },
        logOnceFn,
        p1,
        p2,
      );
    };
    return logOnceFn;
  }

  private log(
    level: BunyanLogLevel,
    p1: string | Record<string, any>,
    p2?: string,
  ): void {
    if (!this.bunyanLogger) {
      // defer logging until bunyan logger is initialized, to avoid losing logs during initialization
      this.queue.push(() => this.log(level, p1, p2));
      return;
    }
    const logFn = this.logger[level];
    if (isString(p1)) {
      logFn(p1);
    } else {
      logFn(p1, p2);
    }
  }
}
