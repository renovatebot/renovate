const logger = require('winston');

const config = {};

if (process.env.LOG_LEVEL) {
  config.logLevel = process.env.LOG_LEVEL;
}
if (process.env.RENOVATE_TOKEN) {
  config.token = process.env.RENOVATE_TOKEN;
}

logger.debug(`Env config: ${JSON.stringify(config)}`);

module.exports = config;
