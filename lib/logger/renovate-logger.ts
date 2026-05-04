import { isString } from '@sindresorhus/is';
import fs from 'fs-extra';
import type pino from 'pino';
import { LOGGER_NOT_INITIALIZED } from '../constants/error-messages.ts';
import { once, reset as onceReset } from './once.ts';
import { addStreamEntry, setStreamLevel } from './pino.ts';
import { getRemappedLevel } from './remap.ts';
import type { LogLevel, LogStream, Logger, PinoLogger } from './types.ts';
import { getMessage, sanitizeValue, toMeta } from './utils.ts';

const loggerLevels: LogLevel[] = [
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
  private _pinoLogger: PinoLogger | undefined;
  private uninitializedWarningFired: boolean;
  private context: string;
  private meta: Record<string, unknown>;

  constructor(
    context: string,
    meta: Record<string, unknown>,
    pinoLogger?: PinoLogger,
  ) {
    this._pinoLogger = pinoLogger;
    this.context = context;
    this.meta = meta;
    for (const level of loggerLevels) {
      this.logger[level] = this.logFactory(level) as never;
      this.logger.once[level] = this.logOnceFn(level);
    }
    this.uninitializedWarningFired = false;
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

  addSerializers(serializers: Record<string, pino.SerializerFn>): void {
    const current = this.ensureLogger();
    this._pinoLogger = current.child({}, { serializers });
  }

  addStream(stream: LogStream): void {
    if (stream.type === 'rotating-file') {
      throw new Error("Rotating files aren't supported");
    }

    if (stream.stream) {
      addStreamEntry({ stream: stream.stream, level: stream.level });
      return;
    }

    if (stream.path) {
      const fileStream = fs.createWriteStream(stream.path, {
        flags: 'a',
        encoding: 'utf8',
      });
      addStreamEntry({ stream: fileStream, level: stream.level });
      return;
    }

    throw new Error("Missing 'stream' or 'path' for log stream");
  }

  childLogger(): RenovateLogger {
    return new RenovateLogger(
      this.context,
      this.meta,
      this.ensureLogger().child({}),
    );
  }

  levels(name: 'stdout' | 'logfile', level: LogLevel): void {
    setStreamLevel(name, level);
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
  set pinoLogger(pinoLogger: PinoLogger) {
    this._pinoLogger = pinoLogger;
    // flush any logs that were queued before pino logger was initialized
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

  private ensureLogger(): PinoLogger {
    if (!this._pinoLogger) {
      throw new Error(LOGGER_NOT_INITIALIZED);
    }
    return this._pinoLogger;
  }

  private logFactory(_level: LogLevel): LoggerFunction {
    return (p1: string | Record<string, any>, p2?: string): void => {
      const meta: Record<string, unknown> = sanitizeValue({
        logContext: this.context,
        ...this.meta,
        ...toMeta(p1),
      });
      const rawMsg = getMessage(p1, p2);
      const msg = isString(rawMsg)
        ? (sanitizeValue(rawMsg) as string)
        : undefined;
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

  private logOnceFn(level: LogLevel): LoggerFunction {
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
    level: LogLevel,
    p1: string | Record<string, any>,
    p2?: string,
  ): void {
    if (!this._pinoLogger) {
      // defer logging until pino logger is initialized, to avoid losing logs during initialization
      this.queue.push(() => this.log(level, p1, p2));
      if (!this.uninitializedWarningFired) {
        // oxlint-disable-next-line no-console -- intentional: display warning when pino isn't initialized
        console.warn(
          `⚠️ NOTE ⚠️: Renovate's logger has not yet been initialized. If you see no other output, this is a bug`,
        );
        this.uninitializedWarningFired = true;
      }
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
