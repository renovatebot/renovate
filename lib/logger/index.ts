import is from '@sindresorhus/is';
import * as bunyan from 'bunyan';
import fs from 'fs-extra';
import { nanoid } from 'nanoid';
import upath from 'upath';
import cmdSerializer from './cmd-serializer';
import configSerializer from './config-serializer';
import errSerializer from './err-serializer';
import { RenovateStream } from './pretty-stdout';
import { RenovateLogger } from './renovate-logger';
import type { BunyanRecord, Logger } from './types';
import {
  ProblemStream,
  getEnv,
  validateLogLevel,
  withSanitizer,
} from './utils';

const problems = new ProblemStream();
let stdoutLevel = validateLogLevel(getEnv('LOG_LEVEL'), 'info');

export function logLevel(): bunyan.LogLevelString {
  return stdoutLevel;
}

export function createDefaultStreams(
  stdoutLevel: bunyan.LogLevelString,
  problems: ProblemStream,
  logFile: string | undefined,
): bunyan.Stream[] {
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

  const problemsStream: bunyan.Stream = {
    name: 'problems',
    level: 'warn' as bunyan.LogLevel,
    stream: problems as any,
    type: 'raw',
  };

  // istanbul ignore next: not easily testable
  const logFileStream: bunyan.Stream | undefined = is.string(logFile)
    ? createLogFileStream(logFile)
    : undefined;

  return [stdout, problemsStream, logFileStream].filter(
    Boolean,
  ) as bunyan.Stream[];
}

// istanbul ignore next: not easily testable
function createLogFileStream(logFile: string): bunyan.Stream {
  // Ensure log file directory exists
  const directoryName = upath.dirname(logFile);
  fs.ensureDirSync(directoryName);

  return {
    name: 'logfile',
    path: logFile,
    level: validateLogLevel(getEnv('LOG_FILE_LEVEL'), 'debug'),
  };
}

function serializedSanitizedLogger(streams: bunyan.Stream[]): bunyan {
  return bunyan.createLogger({
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
    streams: streams.map(withSanitizer),
  });
}

const defaultStreams = createDefaultStreams(
  stdoutLevel,
  problems,
  getEnv('LOG_FILE'),
);

const bunyanLogger = serializedSanitizedLogger(defaultStreams);
const logContext = getEnv('LOG_CONTEXT') ?? nanoid();
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

export function withMeta<T>(obj: Record<string, unknown>, cb: () => T): T {
  setMeta(obj);
  try {
    return cb();
  } finally {
    removeMeta(Object.keys(obj));
  }
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

export function getProblems(): BunyanRecord[] {
  return problems.getProblems();
}

export function clearProblems(): void {
  return problems.clearProblems();
}
