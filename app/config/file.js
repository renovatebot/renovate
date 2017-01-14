const logger = require('winston');

let config = {};
try {
  // eslint-disable-next-line import/no-unresolved,global-require
  config = require('../../config');
} catch (err) {
  // Do nothing
  logger.verbose('No custom config found');
}

logger.debug(`File config = ${JSON.stringify(config)}`);

module.exports = config;
