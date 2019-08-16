const path = require('path');
const file = require('../../lib/config/file');
const customConfig = require('./config/_fixtures/file');

describe('config/file', () => {
  describe('.getConfig()', () => {
    it('returns empty env', () => {
      expect(file.getConfig({ RENOVATE_CONFIG_FILE: 'dummylocation' })).toEqual(
        {}
      );
    });
    it('parses custom config file', () => {
      const configFile = path.resolve(__dirname, './config/_fixtures/file.js');
      expect(file.getConfig({ RENOVATE_CONFIG_FILE: configFile })).toEqual(
        customConfig
      );
    });
    it('migrates', () => {
      const configFile = path.resolve(__dirname, './config/_fixtures/file2.js');
      const res = file.getConfig({ RENOVATE_CONFIG_FILE: configFile });
      expect(res).toMatchSnapshot();
      expect(res.rangeStrategy).toEqual('bump');
    });
  });
});
