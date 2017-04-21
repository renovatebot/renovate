const logger = require('winston');

// Colorize console logs
logger.configure({
  level: process.env.LOG_LEVEL || 'info',
  transports: [new logger.transports.Console({ colorize: true })],
});

module.exports = logger;
