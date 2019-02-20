const path = require('path');
const file = require('../../lib/config/file.js');
const customConfig = require('../_fixtures/config/file');

describe('config/file', () => {
  describe('.getConfig()', () => {
    it('returns empty env', () => {
      expect(file.getConfig({ RENOVATE_CONFIG_FILE: 'dummylocation' })).toEqual(
        {}
      );
    });
    it('parses custom config file', () => {
      const configFile = path.resolve(__dirname, '../_fixtures/config/file.js');
      expect(file.getConfig({ RENOVATE_CONFIG_FILE: configFile })).toEqual(
        customConfig
      );
    });
    it('migrates', () => {
      const configFile = path.resolve(
        __dirname,
        '../_fixtures/config/file2.js'
      );
      const res = file.getConfig({ RENOVATE_CONFIG_FILE: configFile });
      expect(res).toMatchSnapshot();
      expect(res.rangeStrategy).toEqual('bump');
    });
  });
});
