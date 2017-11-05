const defaultConfig = require('../../../lib/config/defaults').getConfig();
const logger = require('../logger');
const api = jest.genMockFromModule('../../../lib/platform/github');

module.exports = {
  ...defaultConfig,
  api,
  logger,
};
