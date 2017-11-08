const defaultConfig = require('../../../lib/config/defaults').getConfig();
const api = jest.genMockFromModule('../../../lib/platform/github');

module.exports = {
  ...defaultConfig,
  api,
};
