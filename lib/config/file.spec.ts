import fs from 'fs';
import upath from 'upath';
import customConfig from './config/__fixtures__/file';
import * as file from './file';

describe('config/file', () => {
  describe('.getConfig()', () => {
    it('returns empty env', () => {
      expect(file.getConfig({ RENOVATE_CONFIG_FILE: 'dummylocation' })).toEqual(
        {}
      );
    });
    it('parses custom config file', () => {
      const configFile = upath.resolve(
        __dirname,
        './config/__fixtures__/file.js'
      );
      expect(file.getConfig({ RENOVATE_CONFIG_FILE: configFile })).toEqual(
        customConfig
      );
    });
    it('migrates', () => {
      const configFile = upath.resolve(
        __dirname,
        './config/__fixtures__/file2.js'
      );
      const res = file.getConfig({ RENOVATE_CONFIG_FILE: configFile });
      expect(res).toMatchSnapshot();
      expect(res.rangeStrategy).toEqual('bump');
    });
    it('informs user when error in parsing config.js', () => {
      const configFile = upath.resolve(
        __dirname,
        './config/__fixtures__/file3.ts'
      );
      const fileContent = `module.exports = {
        "platform": "github",
        "token":"abcdef",
        "logFileLevel": "warn",
        "onboarding": false,
        "gitAuthor": "Renovate Bot <renovate@whitesourcesoftware.com>"
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
    const configFile = upath.resolve(
      __dirname,
      './config/__fixtures__/file4.ts'
    );
    expect(file.getConfig({ RENOVATE_CONFIG_FILE: configFile })).toStrictEqual(
      {}
    );
  });
});
