import is from '@sindresorhus/is';
import * as bunyan from 'bunyan';
import fs from 'fs-extra';
import { nanoid } from 'nanoid';
import upath from 'upath';
import cmdSerializer from './cmd-serializer';
import configSerializer from './config-serializer';
import errSerializer from './err-serializer';
import { once, reset as onceReset } from './once';
import { RenovateStream } from './pretty-stdout';
import { getRemappedLevel } from './remap';
import type { BunyanRecord, Logger } from './types';
import {
  ProblemStream,
  getEnv,
  validateLogLevel,
  withSanitizer,
} from './utils';

const problems = new ProblemStream();
let stdoutLevel = validateLogLevel(getEnv('LOG_LEVEL'), 'info');

export function getProblems(): BunyanRecord[] {
  return problems.getProblems();
}

export function clearProblems(): void {
  return problems.clearProblems();
}

export function logLevel(): bunyan.LogLevelString {
  return stdoutLevel;
}

function createDefaultStreams(
  stdoutLevel: bunyan.LogLevelString,
  problems: ProblemStream,
  logFile: string | undefined,
): bunyan.Stream[] {
  const problemsStream: bunyan.Stream = {
    name: 'problems',
    level: 'warn' as bunyan.LogLevel,
    stream: problems as any,
    type: 'raw',
  };

  const stdout: bunyan.Stream = {
    name: 'stdout',
    level: stdoutLevel,
    stream: process.stdout,
  };

  // istanbul ignore if: not testable
  if (getEnv('LOG_FORMAT') !== 'json') {
    // TODO: typings (#9615)
    const prettyStdOut = new RenovateStream() as any;
    prettyStdOut.pipe(process.stdout);
    stdout.stream = prettyStdOut;
    stdout.type = 'raw';
  }

  const logFileStream: bunyan.Stream | undefined = is.string(logFile)
    ? createLogFileStream(logFile)
    : undefined;

  return [stdout, problemsStream, logFileStream].filter(
    Boolean,
  ) as bunyan.Stream[];
}

// istanbul ignore next: not easily testable
export function createLogFileStream(logFile: string): bunyan.Stream {
  // Ensure log file directory exists
  const directoryName = upath.dirname(logFile);
  fs.ensureDirSync(directoryName);

  return {
    name: 'logfile',
    path: logFile,
    level: validateLogLevel(getEnv('LOG_FILE_LEVEL'), 'debug'),
  };
}

type loggerFunction = (p1: string | Record<string, any>, p2?: string) => void;

function logFactory(
  bunyanLogger: bunyan,
  _level: bunyan.LogLevelString,
  curMeta: Record<string, unknown>,
  logContext: string,
): loggerFunction {
  return function (p1: string | Record<string, any>, p2?: string): void {
    const meta: Record<string, unknown> = {
      logContext,
      ...curMeta,
      ...toMeta(p1),
    };
    const msg = getMessage(p1, p2);
    let level = _level;

    if (is.string(msg)) {
      const remappedLevel = getRemappedLevel(msg);
      // istanbul ignore if: not testable
      if (remappedLevel) {
        meta.oldLevel = level;
        level = remappedLevel;
      }
      bunyanLogger[level](meta, msg);
    } else {
      bunyanLogger[level](meta);
    }
  };
}

function getMessage(
  p1: string | Record<string, any>,
  p2?: string,
): string | undefined {
  return is.string(p1) ? p1 : p2;
}

function toMeta(p1: string | Record<string, any>): Record<string, unknown> {
  return is.object(p1) ? p1 : {};
}

const loggerLevels: bunyan.LogLevelString[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
];

export class RenovateLogger implements Logger {
  logger: Logger = { once: { reset: onceReset } } as any;

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

  trace = this.log.bind(this, 'trace');
  debug = this.log.bind(this, 'debug');
  info = this.log.bind(this, 'info');
  warn = this.log.bind(this, 'warn');
  error = this.log.bind(this, 'error');
  fatal = this.log.bind(this, 'fatal');

  once = this.logger.once;

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

  private logFactory(level: bunyan.LogLevelString): loggerFunction {
    return logFactory(this.bunyanLogger, level, this.meta, this.context);
  }

  private logOnceFn(level: bunyan.LogLevelString): loggerFunction {
    const logOnceFn = (p1: string | Record<string, any>, p2?: string): void => {
      once(() => {
        this.log(level, p1, p2);
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

const defaultStreams = createDefaultStreams(
  stdoutLevel,
  problems,
  getEnv('LOG_FILE'),
);
const bunyanLogger = bunyan.createLogger({
  name: 'renovate',
  serializers: {
    body: configSerializer,
    cmd: cmdSerializer,
    config: configSerializer,
    migratedConfig: configSerializer,
    originalConfig: configSerializer,
    presetConfig: configSerializer,
    oldConfig: configSerializer,
    newConfig: configSerializer,
    err: errSerializer,
  },
  streams: defaultStreams.map(withSanitizer),
});

const logContext: string = getEnv('LOG_CONTEXT') ?? nanoid();
const loggerInternal = new RenovateLogger(bunyanLogger, logContext, {});

export const logger: Logger = loggerInternal;

export function setContext(value: string): void {
  loggerInternal.logContext = value;
}

export function getContext(): any {
  return loggerInternal.logContext;
}

// setMeta overrides existing meta, may remove fields if no longer existing
export function setMeta(obj: Record<string, unknown>): void {
  loggerInternal.setMeta(obj);
}

// addMeta overrides or adds fields but does not remove any
export function addMeta(obj: Record<string, unknown>): void {
  loggerInternal.addMeta(obj);
}

// removeMeta removes the provided fields from meta
export function removeMeta(fields: string[]): void {
  loggerInternal.removeMeta(fields);
}

export /* istanbul ignore next */ function addStream(
  stream: bunyan.Stream,
): void {
  loggerInternal.addStream(stream);
}

/**
 * For testing purposes only
 * @param name stream name
 * @param level log level
 * @private
 */
export function levels(
  name: 'stdout' | 'logfile',
  level: bunyan.LogLevelString,
): void {
  bunyanLogger.levels(name, level);
  if (name === 'stdout') {
    stdoutLevel = level;
  }
}
