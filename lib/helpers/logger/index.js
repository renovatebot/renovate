const bunyan = require('bunyan');
const PrettyStdout = require('./pretty-stdout').RenovateStream;
const configSerializer = require('./config-serializer');

const prettyStdOut = new PrettyStdout();
prettyStdOut.pipe(process.stdout);

const logger = bunyan.createLogger({
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

module.exports = logger;
