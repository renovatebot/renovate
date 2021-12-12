import fs from 'fs';
import { DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import { logger } from '../../../../logger';
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
    it.each([
      ['custom js config file', 'file.js'],
      ['custom js config file exporting a Promise', 'filePromise.js'],
      ['custom js config file exporting a function', 'fileFunction.js'],
      // The next two are different syntactic ways of expressing the same thing
      [
        'custom js config file exporting a function returning a Promise',
        'fileFunctionPromise.js',
      ],
      [
        'custom js config file exporting an async function',
        'fileAsyncFunction.js',
      ],
      ['JSON5 config file', 'config.json5'],
      ['YAML config file', 'config.yaml'],
    ])('parses %s', async (fileType, filePath) => {
      const configFile = upath.resolve(__dirname, './__fixtures__/', filePath);
      expect(
        await file.getConfig({ RENOVATE_CONFIG_FILE: configFile })
      ).toEqual(customConfig);
    });

    it('migrates', async () => {
      const configFile = upath.resolve(__dirname, './__fixtures__/file2.js');
      const res = await file.getConfig({ RENOVATE_CONFIG_FILE: configFile });
      expect(res).toMatchSnapshot();
      expect(res.rangeStrategy).toBe('bump');
    });

    it('parse and returns empty config if there is no RENOVATE_CONFIG_FILE in env', async () => {
      expect(await file.getConfig({})).toBeDefined();
    });

    it.each([
      [
        'config.js',
        `module.exports = {
        "platform": "github",
        "token":"abcdef",
        "logFileLevel": "warn",
        "onboarding": false,
        "gitAuthor": "Renovate Bot <renovate@whitesourcesoftware.com>"
        "onboardingConfig": {
          "extends": ["config:base"],
        },
        "repositories": [ "test/test" ],
      };`,
      ],
      ['config.json5', `"invalid":`],
      ['config.yaml', `invalid: -`],
    ])(
      'fatal error and exit if error in parsing %s',
      async (fileName, fileContent) => {
        const mockProcessExit = jest
          .spyOn(process, 'exit')
          .mockImplementationOnce(() => undefined as never);
        const configFile = upath.resolve(tmp.path, fileName);
        fs.writeFileSync(configFile, fileContent, { encoding: 'utf8' });
        await file.getConfig({ RENOVATE_CONFIG_FILE: configFile });
        expect(mockProcessExit).toHaveBeenCalledWith(1);
        fs.unlinkSync(configFile);
      }
    );

    it('fatal error and exit if custom config file does not exist', async () => {
      const mockProcessExit = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);

      const configFile = upath.resolve(tmp.path, './file4.js');
      await file.getConfig({ RENOVATE_CONFIG_FILE: configFile });

      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it.each([
      ['invalid config file type', './file.txt'],
      ['missing config file type', './file'],
    ])('fatal error and exit if %s', async (fileType, filePath) => {
      const mockProcessExit = jest
        .spyOn(process, 'exit')
        .mockImplementationOnce(() => undefined as never);
      const configFile = upath.resolve(tmp.path, filePath);
      fs.writeFileSync(configFile, `{"token": "abc"}`, { encoding: 'utf8' });
      await file.getConfig({ RENOVATE_CONFIG_FILE: configFile });
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      expect(logger.fatal).toHaveBeenCalledWith('Unsupported file type');
      fs.unlinkSync(configFile);
    });
  });
});
