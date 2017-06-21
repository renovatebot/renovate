const bunyan = require('bunyan');
const PrettyStdout = require('./logger-pretty-stdout');
const traverse = require('traverse');

const prettyStdOut = new PrettyStdout();
prettyStdOut.pipe(process.stdout);

function configSerializer(config) {
  const redactedFields = ['token', 'githubAppKey'];
  const functionFields = ['api', 'logger'];
  // eslint-disable-next-line array-callback-return
  return traverse(config).map(function scrub(val) {
    if (val && redactedFields.indexOf(this.key) !== -1) {
      this.update('***********');
    }
    if (val && functionFields.indexOf(this.key) !== -1) {
      this.update('[Function]');
    }
  });
}

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
