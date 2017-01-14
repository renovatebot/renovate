const logger = require('winston');

// Set log level from environment. It may be overriden later by configuration
logger.level = process.env.LOG_LEVEL || 'info';

// Colorize console logs
logger.configure({
  transports: [
    new (logger.transports.Console)({ colorize: true }),
  ],
});

module.exports = logger;
