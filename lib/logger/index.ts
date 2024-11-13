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

let logContext: string = getEnv('LOG_CONTEXT') ?? nanoid();
let curMeta: Record<string, unknown> = {};

const problems = new ProblemStream();

let stdoutLevel = validateLogLevel(getEnv('LOG_LEVEL'), 'info');
const stdout: bunyan.Stream = {
  name: 'stdout',
  level: stdoutLevel,
  stream: process.stdout,
};

export function logLevel(): bunyan.LogLevelString {
  return stdoutLevel;
}

// istanbul ignore if: not testable
if (getEnv('LOG_FORMAT') !== 'json') {
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

const logFile = getEnv('LOG_FILE');
// istanbul ignore if: not easily testable
if (is.string(logFile)) {
  // ensure log file directory exists
  const directoryName = upath.dirname(logFile);
  fs.ensureDirSync(directoryName);

  addStream({
    name: 'logfile',
    path: logFile,
    level: validateLogLevel(getEnv('LOG_FILE_LEVEL'), 'debug'),
  });
}

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

export function getProblems(): BunyanRecord[] {
  return problems.getProblems();
}

export function clearProblems(): void {
  return problems.clearProblems();
}
