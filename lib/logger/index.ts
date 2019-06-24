import * as Logger from 'bunyan';

const is = require('@sindresorhus/is');
const PrettyStdout = require('./pretty-stdout').RenovateStream;
const configSerializer = require('./config-serializer');
const errSerializer = require('./err-serializer');
const cmdSerializer = require('./cmd-serializer');

let meta = {};

const stdout: Logger.Stream = {
  name: 'stdout',
  level: (process.env.LOG_LEVEL as Logger.LogLevel) || 'info',
  stream: process.stdout,
  type: 'raw',
};

if (process.env.LOG_FORMAT !== 'json') {
  const prettyStdOut = new PrettyStdout();
  prettyStdOut.pipe(process.stdout);
  stdout.stream = prettyStdOut;
}

const bunyanLogger: any = Logger.createLogger({
  name: 'renovate',
  serializers: {
    body: configSerializer,
    cmd: cmdSerializer,
    config: configSerializer,
    err: errSerializer,
  },
  streams: [stdout],
});

const logFactory = (level: string): any => {
  return (p1: any, p2: any): Logger => {
    (global as any).renovateError =
      (global as any).renovateError || level === 'error' || level === 'fatal';
    if (p2) {
      // meta and msg provided
      return bunyanLogger[level]({ ...meta, ...p1 }, p2);
    }
    if (is.string(p1)) {
      // only message provided
      return bunyanLogger[level](meta, p1);
    }
    // only meta provided
    return bunyanLogger[level]({ ...meta, ...p1 });
  };
};

const loggerLevels: string[] = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'child',
];

// eslint-disable-next-line import/no-mutable-exports
export const logger: any = {};

loggerLevels.forEach(loggerLevel => {
  logger[loggerLevel] = logFactory(loggerLevel);
});

// setMeta overrides existing meta
export function setMeta(obj: any) {
  meta = { ...obj };
}

export function levels(name: string, level: Logger.LogLevel): void {
  bunyanLogger.levels(name, level);
}
