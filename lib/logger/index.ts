import * as bunyan from 'bunyan';

import is from '@sindresorhus/is';
import { RenovateStream } from './pretty-stdout';
import configSerializer from './config-serializer';
import errSerializer from './err-serializer';
import cmdSerializer from './cmd-serializer';

let meta = {};

const stdout: bunyan.Stream = {
  name: 'stdout',
  level: (process.env.LOG_LEVEL as bunyan.LogLevel) || 'info',
  stream: process.stdout,
};

if (process.env.LOG_FORMAT !== 'json') {
  // TODO: typings
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
    err: errSerializer,
  },
  streams: [stdout],
});

const logFactory = (level: bunyan.LogLevelString): any => {
  return (p1: any, p2: any): void => {
    global.renovateError =
      global.renovateError || level === 'error' || level === 'fatal';
    if (p2) {
      // meta and msg provided
      bunyanLogger[level]({ ...meta, ...p1 }, p2);
    } else if (is.string(p1)) {
      // only message provided
      bunyanLogger[level](meta, p1);
    } else {
      // only meta provided
      bunyanLogger[level](meta, p1);
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

interface Logger {
  trace(msg: string): void;
  trace(meta: Record<string, any>, msg?: string): void;
  debug(msg: string): void;
  debug(meta: Record<string, any>, msg?: string): void;
  info(msg: string): void;
  info(meta: Record<string, any>, msg?: string): void;
  warn(msg: string): void;
  warn(meta: Record<string, any>, msg?: string): void;
  error(msg: string): void;
  error(meta: Record<string, any>, msg?: string): void;
  fatal(msg: string): void;
  fatal(meta: Record<string, any>, msg?: string): void;
}

export const logger: Logger = {} as any;

loggerLevels.forEach(loggerLevel => {
  logger[loggerLevel] = logFactory(loggerLevel);
});

// setMeta overrides existing meta
export function setMeta(obj: any) {
  meta = { ...obj };
}

export function levels(name: string, level: bunyan.LogLevel): void {
  bunyanLogger.levels(name, level);
}
