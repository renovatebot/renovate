import fs from 'node:fs';
import fsExtra from 'fs-extra';
import { DirectoryResult, dir } from 'tmp-promise';
import upath from 'upath';
import { logger } from '../../../../logger';
import customConfig from './__fixtures__/config';
import * as file from './file';

describe('workers/global/config/parse/file', () => {
  const processExitSpy = jest.spyOn(process, 'exit');
  const fsPathExistsSpy = jest.spyOn(fsExtra, 'pathExists');
  const fsRemoveSpy = jest.spyOn(fsExtra, 'remove');

  let tmp: DirectoryResult;

  beforeAll(async () => {
    tmp = await dir({ unsafeCleanup: true });
  });

  afterAll(async () => {
    await tmp.cleanup();
  });

  describe('.getConfig()', () => {
    it.each([
      ['custom js config file', 'config.js'],
      ['custom js config file exporting a Promise', 'config-promise.js'],
      ['custom js config file exporting a function', 'config-function.js'],
      // The next two are different syntactic ways of expressing the same thing
      [
        'custom js config file exporting a function returning a Promise',
        'config-function-promise.js',
      ],
      [
        'custom js config file exporting an async function',
        'config-async-function.js',
      ],
      ['.renovaterc', '.renovaterc'],
      ['JSON5 config file', 'config.json5'],
      ['YAML config file', 'config.yaml'],
    ])('parses %s', async (_fileType, filePath) => {
      const configFile = upath.resolve(__dirname, './__fixtures__/', filePath);
      expect(
        await file.getConfig({ RENOVATE_CONFIG_FILE: configFile }),
      ).toEqual(customConfig);
    });

    it('migrates', async () => {
      const configFile = upath.resolve(__dirname, './__fixtures__/config2.js');
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
          "extends": ["config:recommended"],
        },
        "repositories": [ "test/test" ],
      };`,
      ],
      ['config.json5', `"invalid":`],
      ['config.yaml', `invalid: -`],
    ])(
      'fatal error and exit if error in parsing %s',
      async (fileName, fileContent) => {
        processExitSpy.mockImplementationOnce(() => undefined as never);
        const configFile = upath.resolve(tmp.path, fileName);
        fs.writeFileSync(configFile, fileContent, { encoding: 'utf8' });
        await file.getConfig({ RENOVATE_CONFIG_FILE: configFile });
        expect(processExitSpy).toHaveBeenCalledWith(1);
        fs.unlinkSync(configFile);
      },
    );

    it('fatal error and exit if custom config file does not exist', async () => {
      processExitSpy
        .mockImplementationOnce(() => undefined as never)
        .mockImplementationOnce(() => undefined as never);
      const configFile = upath.resolve(tmp.path, './file4.js');

      await file.getConfig({ RENOVATE_CONFIG_FILE: configFile });

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('fatal error and exit if config.js contains unresolved env var', async () => {
      processExitSpy.mockImplementationOnce(() => undefined as never);

      const configFile = upath.resolve(
        __dirname,
        './__fixtures__/config-ref-error.js-invalid',
      );
      const tmpDir = tmp.path;
      await fsExtra.ensureDir(tmpDir);

      const tmpConfigFile = upath.resolve(tmpDir, 'config-ref-error.js');
      await fsExtra.copy(configFile, tmpConfigFile);

      await file.getConfig({ RENOVATE_CONFIG_FILE: tmpConfigFile });

      expect(logger.fatal).toHaveBeenCalledWith(
        `Error parsing config file due to unresolved variable(s): CI_API_V4_URL is not defined`,
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it.each([
      ['invalid config file type', './file.txt'],
      ['missing config file type', './file'],
    ])('fatal error and exit if %s', async (fileType, filePath) => {
      processExitSpy.mockImplementationOnce(() => undefined as never);
      const configFile = upath.resolve(tmp.path, filePath);
      fs.writeFileSync(configFile, `{"token": "abc"}`, { encoding: 'utf8' });
      await file.getConfig({ RENOVATE_CONFIG_FILE: configFile });
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(logger.fatal).toHaveBeenCalledWith('Unsupported file type');
      fs.unlinkSync(configFile);
    });

    it('removes the config file if RENOVATE_CONFIG_FILE & RENOVATE_X_DELETE_CONFIG_FILE are set', async () => {
      fsRemoveSpy.mockImplementationOnce(() => {
        // no-op
      });
      fsPathExistsSpy
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(true as never);
      const configFile = upath.resolve(tmp.path, './config.json');
      fs.writeFileSync(configFile, `{"token": "abc"}`, { encoding: 'utf8' });

      await file.getConfig({
        RENOVATE_CONFIG_FILE: configFile,
        RENOVATE_X_DELETE_CONFIG_FILE: 'true',
      });

      expect(processExitSpy).not.toHaveBeenCalled();
      expect(fsRemoveSpy).toHaveBeenCalledTimes(1);
      expect(fsRemoveSpy).toHaveBeenCalledWith(configFile);
      fs.unlinkSync(configFile);
    });
  });

  describe('deleteConfigFile()', () => {
    it.each([[undefined], [' ']])(
      'skip when RENOVATE_CONFIG_FILE is not set ("%s")',
      async (configFile) => {
        await file.deleteNonDefaultConfig({ RENOVATE_CONFIG_FILE: configFile });

        expect(fsRemoveSpy).toHaveBeenCalledTimes(0);
      },
    );

    it('skip when config file does not exist', async () => {
      fsPathExistsSpy.mockResolvedValueOnce(false as never);

      await file.deleteNonDefaultConfig({
        RENOVATE_CONFIG_FILE: 'path',
        RENOVATE_X_DELETE_CONFIG_FILE: 'true',
      });

      expect(fsRemoveSpy).toHaveBeenCalledTimes(0);
    });

    it.each([['false'], [' ']])(
      'skip if RENOVATE_X_DELETE_CONFIG_FILE is not set ("%s")',
      async (deleteConfig) => {
        fsPathExistsSpy.mockResolvedValueOnce(true as never);

        await file.deleteNonDefaultConfig({
          RENOVATE_X_DELETE_CONFIG_FILE: deleteConfig,
          RENOVATE_CONFIG_FILE: '/path/to/config.js',
        });

        expect(fsRemoveSpy).toHaveBeenCalledTimes(0);
      },
    );

    it('removes the specified config file', async () => {
      fsRemoveSpy.mockImplementationOnce(() => {
        // no-op
      });
      fsPathExistsSpy.mockResolvedValueOnce(true as never);
      const configFile = '/path/to/config.js';

      await file.deleteNonDefaultConfig({
        RENOVATE_CONFIG_FILE: configFile,
        RENOVATE_X_DELETE_CONFIG_FILE: 'true',
      });

      expect(fsRemoveSpy).toHaveBeenCalledTimes(1);
      expect(fsRemoveSpy).toHaveBeenCalledWith(configFile);
      expect(logger.trace).toHaveBeenCalledWith(
        expect.anything(),
        'config file successfully deleted',
      );
    });

    it('fails silently when attempting to delete the config file', async () => {
      fsRemoveSpy.mockImplementationOnce(() => {
        throw new Error();
      });
      fsPathExistsSpy.mockResolvedValueOnce(true as never);
      const configFile = '/path/to/config.js';

      await file.deleteNonDefaultConfig({
        RENOVATE_CONFIG_FILE: configFile,
        RENOVATE_X_DELETE_CONFIG_FILE: 'true',
      });

      expect(fsRemoveSpy).toHaveBeenCalledTimes(1);
      expect(fsRemoveSpy).toHaveBeenCalledWith(configFile);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        'error deleting config file',
      );
    });
  });
});
