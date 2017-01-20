const file = require('../../lib/config/file.js');
const customConfig = require('../_fixtures/config/file');

describe('config/file', () => {
  describe('.getConfig()', () => {
    it('returns empty env', () => {
      file.getConfig({}).should.eql({});
    });
    it('parses custom config file', () => {
      file.getConfig({ RENOVATE_CONFIG_FILE: 'test/_fixtures/config/file.js' }).should.eql(customConfig);
    });
  });
});
