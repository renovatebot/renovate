import fs from 'fs';
import { DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import customConfig from './__fixtures__/file';
import * as file from './file';

describe('workers/global/config/parse/file', () => {
  let tmp: DirectoryResult;

  beforeAll(async () => {
    tmp = await dir({ unsafeCleanup: true });
  });

  afterAll(async () => {
    await tmp.cleanup();
  });

  describe('.getConfig()', () => {
    it('parses custom config file', () => {
      const configFile = upath.resolve(__dirname, './__fixtures__/file.js');
      expect(file.getConfig({ RENOVATE_CONFIG_FILE: configFile })).toEqual(
        customConfig
      );
    });
    it('migrates', () => {
      const configFile = upath.resolve(__dirname, './__fixtures__/file2.js');
      const res = file.getConfig({ RENOVATE_CONFIG_FILE: configFile });
      expect(res).toMatchSnapshot();
      expect(res.rangeStrategy).toEqual('bump');
    });

    it('parse and returns empty config if there is no RENOVATE_CONFIG_FILE in env', () => {
      expect(file.getConfig({})).toBeDefined();
    });

    it('fatal error and exit if error in parsing config.js', () => {
      const mockProcessExit = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      const configFile = upath.resolve(tmp.path, './file3.js');
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
      file.getConfig({ RENOVATE_CONFIG_FILE: configFile });
      expect(mockProcessExit).toHaveBeenCalledWith(1);

      fs.unlinkSync(configFile);
    });

    it('fatal error and exit if custom config file does not exist', () => {
      const mockProcessExit = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);

      const configFile = upath.resolve(tmp.path, './file4.js');
      file.getConfig({ RENOVATE_CONFIG_FILE: configFile });

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
