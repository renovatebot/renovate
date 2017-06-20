const bunyan = require('bunyan');
const CliHelper = require('./helpers/cli');

const cliHelper = new CliHelper();
cliHelper.pipe(process.stdout);

const logger = bunyan.createLogger({
  name: 'myapp',
  streams: [
    {
      name: 'stdout',
      level: process.env.LOG_LEVEL || 'info',
      type: 'raw',
      stream: cliHelper,
    },
  ],
});

module.exports = logger;
