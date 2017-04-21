const path = require('path');
const file = require('../../lib/config/file.js');
const customConfig = require('../_fixtures/config/file');

describe('config/file', () => {
  describe('.getConfig()', () => {
    it('returns empty env', () => {
      file.getConfig({}).should.eql({});
    });
    it('parses custom config file', () => {
      const configFile = path.resolve(__dirname, '../_fixtures/config/file.js');
      file
        .getConfig({ RENOVATE_CONFIG_FILE: configFile })
        .should.eql(customConfig);
    });
  });
});
