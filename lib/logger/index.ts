import is from '@sindresorhus/is';
import * as bunyan from 'bunyan';
import * as shortid from 'shortid';
import cmdSerializer from './cmd-serializer';
import configSerializer from './config-serializer';
import errSerializer from './err-serializer';
import { RenovateStream } from './pretty-stdout';
import type { BunyanRecord, Logger } from './types';
import { ProblemStream, withSanitizer } from './utils';

let logContext: string = process.env.LOG_CONTEXT || shortid.generate();
let curMeta = {};

const problems = new ProblemStream();

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

const logFactory =
  (level: bunyan.LogLevelString): any =>
  (p1: any, p2: any): void => {
    if (p2) {
      // meta and msg provided
      bunyanLogger[level]({ logContext, ...curMeta, ...p1 }, p2);
    } else if (is.string(p1)) {
      // only message provided
      bunyanLogger[level]({ logContext, ...curMeta }, p1);
    } else {
      // only meta provided
      bunyanLogger[level]({ logContext, ...curMeta, ...p1 });
    }
  };

const loggerLevels: bunyan.LogLevelString[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
];

export const logger: Logger = {} as any;

loggerLevels.forEach((loggerLevel) => {
  logger[loggerLevel] = logFactory(loggerLevel);
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
  stream: bunyan.Stream
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
