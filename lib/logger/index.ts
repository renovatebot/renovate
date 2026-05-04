// Do not static import `pino` here!
// Otherwise otel can't instrument it.

import { randomUUID } from 'node:crypto';
import { ProblemStream } from './problem-stream.ts';
import { RenovateLogger } from './renovate-logger.ts';
import type { LogLevel, LogRecord, LogStream, Logger } from './types.ts';
import { getEnv } from './utils.ts';

const problems = new ProblemStream();
let stdoutLevel: LogLevel = 'info';

export function logLevel(): LogLevel {
  return stdoutLevel;
}

const loggerInternal = new RenovateLogger(
  getEnv('LOG_CONTEXT') ?? randomUUID(),
  {},
);

export const logger: Logger = loggerInternal;

export async function init(): Promise<void> {
  // dynamic import to allow pino to be instrumented by otel
  const { createLogger, validateLogLevel } = await import('./pino.ts');
  stdoutLevel = validateLogLevel(getEnv('LOG_LEVEL'), 'info');
  const pinoLogger = createLogger(stdoutLevel, problems);
  loggerInternal.pinoLogger = pinoLogger;
}

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
  addMeta(obj);
  try {
    return cb();
  } finally {
    removeMeta(Object.keys(obj));
  }
}

export function addStream(stream: LogStream): void {
  loggerInternal.addStream(stream);
}

/**
 * For testing purposes only
 * @param name stream name
 * @param level log level
 * @private
 */
export function levels(name: 'stdout' | 'logfile', level: LogLevel): void {
  loggerInternal.levels(name, level);
  // v8 ignore else -- TODO: add test #40625
  if (name === 'stdout') {
    stdoutLevel = level;
  }
}

export function getProblems(): LogRecord[] {
  return problems.getProblems();
}

export function clearProblems(): void {
  return problems.clearProblems();
}
