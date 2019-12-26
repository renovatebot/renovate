import path from 'path';
import fs from 'fs';
import * as file from '../../lib/config/file';
import customConfig from './config/_fixtures/file';

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
    it('informs user when error in parsing config.js', () => {
      const configFile = path.resolve(__dirname, './config/_fixtures/file3.js');
      const fileContent = `module.exports = {
        "platform": "github",
        "token":"abcdef",
        "logFileLevel": "warn",
        "logLevel": "info",
        "onboarding": false,
        "gitAuthor": "Renovate Bot <bot@renovateapp.com>"
        "onboardingConfig": {
          "extends": ["config:base"],
        },
        "repositories": [ "test/test" ],
      };`;
      fs.writeFileSync(configFile, fileContent, { encoding: 'utf8' });
      expect(
        file.getConfig({ RENOVATE_CONFIG_FILE: configFile })
      ).toStrictEqual({});
      fs.unlinkSync(configFile);
    });
  });
  it('handles when invalid file location is provided', () => {
    const configFile = path.resolve(__dirname, './config/_fixtures/file4.js');
    expect(file.getConfig({ RENOVATE_CONFIG_FILE: configFile })).toStrictEqual(
      {}
    );
  });
});
