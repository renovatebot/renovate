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

export const logger = {
  trace: logFactory('trace'),
  debug: logFactory('debug'),
  info: logFactory('info'),
  warn: logFactory('warn'),
  error: logFactory('error'),
  fatal: logFactory('fatal'),
  child: logFactory('child'),
};

// setMeta overrides existing meta
export function setMeta(obj: any) {
  meta = { ...obj };
}
