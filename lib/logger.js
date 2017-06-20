const bunyan = require('bunyan');

const logger = bunyan.createLogger({
  name: 'myapp',
  streams: [
    {
      level: process.env.LOG_LEVEL || 'info',
      stream: process.stdout, // log INFO and above to stdout
    },
  ],
});

module.exports = logger;
