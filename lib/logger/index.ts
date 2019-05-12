import * as Logger from 'bunyan';
const PrettyStdout = require('./pretty-stdout').RenovateStream;
const configSerializer = require('./config-serializer');
const errSerializer = require('./err-serializer');

let logger: Logger;

const stdout: Logger.Stream = {
  name: 'stdout',
  level: (process.env.LOG_LEVEL as Logger.LogLevel) || 'info',
  stream: process.stdout,
};

if (process.env.LOG_FORMAT !== 'json') {
  const prettyStdOut = new PrettyStdout();
  prettyStdOut.pipe(process.stdout);
  stdout.type = 'raw';
  stdout.stream = prettyStdOut;
}

logger = Logger.createLogger({
  name: 'renovate',
  serializers: {
    body: configSerializer,
    config: configSerializer,
    err: errSerializer,
  },
  streams: [stdout],
});

export { logger };
