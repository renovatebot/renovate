const bunyan = require('bunyan');
const PrettyStdout = require('./pretty-stdout').RenovateStream;
const configSerializer = require('./config-serializer');

let bunyanLogger;
let meta = {};

function initLogger() {
  const prettyStdOut = new PrettyStdout();
  prettyStdOut.pipe(process.stdout);

  bunyanLogger = bunyan.createLogger({
    name: 'renovate',
    serializers: {
      config: configSerializer,
    },
    streams: [
      {
        name: 'stdout',
        level: process.env.LOG_LEVEL || 'info',
        type: 'raw',
        stream: prettyStdOut,
      },
    ],
  });

  global.logger = {};

  const logFunctions = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'child',
  ];
  logFunctions.forEach(x => {
    global.logger[x] = (p1, p2) => {
      if (p2) {
        // meta and msg provided
        return bunyanLogger[x]({ ...meta, ...p1 }, p2);
      }
      if (typeof p1 === 'string') {
        // only message provided
        return bunyanLogger[x](meta, p1);
      }
      // only meta provided
      return bunyanLogger[x]({ ...meta, ...p1 });
    };
  });

  global.logger.addStream = stream => {
    bunyanLogger.addStream(stream);
  };
  global.logger.levels = (stream, level) => {
    bunyanLogger.levels(stream, level);
  };

  // setMeta overrides existing meta
  global.logger.setMeta = function setMeta(obj) {
    meta = { ...obj };
  };
}

module.exports = {
  initLogger,
};
