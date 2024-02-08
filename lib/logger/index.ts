import is from '@sindresorhus/is';
import * as bunyan from 'bunyan';
import { nanoid } from 'nanoid';
import cmdSerializer from './cmd-serializer';
import configSerializer from './config-serializer';
import errSerializer from './err-serializer';
import { once, reset as onceReset } from './once';
import { RenovateStream } from './pretty-stdout';
import { getRemappedLevel } from './remap';
import type { BunyanRecord, Logger } from './types';
import { ProblemStream, validateLogLevel, withSanitizer } from './utils';

let logContext: string = process.env.LOG_CONTEXT ?? nanoid();
let curMeta: Record<string, unknown> = {};

const problems = new ProblemStream();

// istanbul ignore if: not easily testable
if (is.string(process.env.LOG_LEVEL)) {
  process.env.LOG_LEVEL = process.env.LOG_LEVEL.toLowerCase().trim();
}

validateLogLevel(process.env.LOG_LEVEL);
const stdout: bunyan.Stream = {
  name: 'stdout',
  level:
    (process.env.LOG_LEVEL as bunyan.LogLevel) ||
    /* istanbul ignore next: not testable */ 'info',
  stream: process.stdout,
};

// istanbul ignore else: not testable
if (process.env.LOG_FORMAT !== 'json') {
  // TODO: typings (#9615)
  const prettyStdOut = new RenovateStream() as any;
  prettyStdOut.pipe(process.stdout);
  stdout.stream = prettyStdOut;
  stdout.type = 'raw';
}

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
  streams: [
    stdout,
    {
      name: 'problems',
      level: 'warn' as bunyan.LogLevel,
      stream: problems as any,
      type: 'raw',
    },
  ].map(withSanitizer),
});

const logFactory = (
  _level: bunyan.LogLevelString,
): ((p1: unknown, p2: unknown) => void) => {
  return (p1: any, p2: any): void => {
    let level = _level;
    if (p2) {
      // meta and msg provided
      const msg = p2;
      const meta: Record<string, unknown> = { logContext, ...curMeta, ...p1 };
      const remappedLevel = getRemappedLevel(msg);
      // istanbul ignore if: not testable
      if (remappedLevel) {
        meta.oldLevel = level;
        level = remappedLevel;
      }
      bunyanLogger[level](meta, msg);
    } else if (is.string(p1)) {
      // only message provided
      const msg = p1;
      const meta: Record<string, unknown> = { logContext, ...curMeta };
      const remappedLevel = getRemappedLevel(msg);
      // istanbul ignore if: not testable
      if (remappedLevel) {
        meta.oldLevel = level;
        level = remappedLevel;
      }
      bunyanLogger[level](meta, msg);
    } else {
      // only meta provided
      bunyanLogger[level]({ logContext, ...curMeta, ...p1 });
    }
  };
};

const loggerLevels: bunyan.LogLevelString[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
];

export const logger: Logger = { once: { reset: onceReset } } as any;

loggerLevels.forEach((loggerLevel) => {
  logger[loggerLevel] = logFactory(loggerLevel) as never;

  const logOnceFn = (p1: any, p2: any): void => {
    once(() => {
      const logFn = logger[loggerLevel];
      if (is.undefined(p2)) {
        logFn(p1);
      } else {
        logFn(p1, p2);
      }
    }, logOnceFn);
  };
  logger.once[loggerLevel] = logOnceFn as never;
});

export function setContext(value: string): void {
  logContext = value;
}

export function getContext(): any {
  return logContext;
}

// setMeta overrides existing meta, may remove fields if no longer existing
export function setMeta(obj: Record<string, unknown>): void {
  curMeta = { ...obj };
}

// addMeta overrides or adds fields but does not remove any
export function addMeta(obj: Record<string, unknown>): void {
  curMeta = { ...curMeta, ...obj };
}

// removeMeta removes the provided fields from meta
export function removeMeta(fields: string[]): void {
  Object.keys(curMeta).forEach((key) => {
    if (fields.includes(key)) {
      delete curMeta[key];
    }
  });
}

export /* istanbul ignore next */ function addStream(
  stream: bunyan.Stream,
): void {
  bunyanLogger.addStream(withSanitizer(stream));
}

export function levels(name: string, level: bunyan.LogLevel): void {
  bunyanLogger.levels(name, level);
}

export function getProblems(): BunyanRecord[] {
  return problems.getProblems();
}

export function clearProblems(): void {
  return problems.clearProblems();
}
