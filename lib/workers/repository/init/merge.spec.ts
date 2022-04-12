import {
  RenovateConfig,
  fs,
  getConfig,
  git,
  mocked,
  platform,
} from '../../../../test/util';
import * as _migrateAndValidate from '../../../config/migrate-validate';
import * as _migrate from '../../../config/migration';
import { initialize } from '../../../util/cache/repository';
import {
  checkForRepoConfigError,
  detectRepoFileConfig,
  mergeRenovateConfig,
} from './merge';

jest.mock('../../../util/fs');
jest.mock('../../../util/git');

const migrate = mocked(_migrate);
const migrateAndValidate = mocked(_migrateAndValidate);

let config: RenovateConfig;

beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

jest.mock('../../../config/migration');
jest.mock('../../../config/migrate-validate');

describe('workers/repository/init/merge', () => {
  describe('detectRepoFileConfig()', () => {
    beforeEach(async () => {
      await initialize({});
    });

    it('returns config if not found', async () => {
      git.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(await detectRepoFileConfig()).toEqual({});
    });

    it('uses package.json config if found', async () => {
      git.getFileList.mockResolvedValue(['package.json']);
      const pJson = JSON.stringify({
        name: 'something',
        renovate: {
          prHourlyLimit: 10,
        },
      });
      fs.readLocalFile.mockResolvedValue(pJson);
      platform.getJsonFile.mockResolvedValueOnce(pJson);
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'package.json',
        configFileParsed: { prHourlyLimit: 10 },
      });
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'package.json',
        configFileParsed: undefined,
      });
    });

    it('massages package.json renovate string', async () => {
      git.getFileList.mockResolvedValue(['package.json']);
      const pJson = JSON.stringify({
        name: 'something',
        renovate: 'github>renovatebot/renovate',
      });
      fs.readLocalFile.mockResolvedValue(pJson);
      platform.getJsonFile.mockResolvedValueOnce(pJson);
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'package.json',
        configFileParsed: { extends: ['github>renovatebot/renovate'] },
      });
    });

    it('returns error if cannot parse', async () => {
      git.getFileList.mockResolvedValue(['package.json', 'renovate.json']);
      fs.readLocalFile.mockResolvedValue('cannot parse');
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'renovate.json',
        configFileParseError: {
          validationError: 'Invalid JSON (parsing failed)',
          validationMessage: 'Syntax error near cannot par',
        },
      });
    });

    it('throws error if duplicate keys', async () => {
      git.getFileList.mockResolvedValue(['package.json', '.renovaterc']);
      fs.readLocalFile.mockResolvedValue(
        '{ "enabled": true, "enabled": false }'
      );
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.renovaterc',
        configFileParseError: {
          validationError: 'Duplicate keys in JSON',
          validationMessage:
            '"Syntax error: duplicated keys \\"enabled\\" near \\": false }"',
        },
      });
    });

    it('finds and parse renovate.json5', async () => {
      git.getFileList.mockResolvedValue(['package.json', 'renovate.json5']);
      fs.readLocalFile.mockResolvedValue(`{
        // this is json5 format
      }`);
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'renovate.json5',
        configFileParsed: {},
      });
    });

    it('finds .github/renovate.json', async () => {
      git.getFileList.mockResolvedValue([
        'package.json',
        '.github/renovate.json',
      ]);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.github/renovate.json',
        configFileParsed: {},
      });
    });

    it('finds .gitlab/renovate.json', async () => {
      git.getFileList.mockResolvedValue([
        'package.json',
        '.gitlab/renovate.json',
      ]);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.gitlab/renovate.json',
        configFileParsed: {},
      });
    });

    it('finds .renovaterc.json', async () => {
      git.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      platform.getJsonFile.mockResolvedValueOnce('{"something":"new"}');
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.renovaterc.json',
        configFileParsed: {},
      });
      expect(await detectRepoFileConfig()).toMatchInlineSnapshot(`
        Object {
          "configFileName": ".renovaterc.json",
          "configFileParsed": "{\\"something\\":\\"new\\"}",
        }
      `);
    });
  });

  describe('checkForRepoConfigError', () => {
    it('returns if no error', () => {
      expect(checkForRepoConfigError({})).toBeUndefined();
    });

    it('throws on error', () => {
      expect(() =>
        checkForRepoConfigError({
          configFileParseError: { validationError: '', validationMessage: '' },
        })
      ).toThrow();
    });
  });

  describe('mergeRenovateConfig()', () => {
    beforeEach(() => {
      migrate.migrateConfig.mockReturnValue({
        isMigrated: false,
        migratedConfig: {},
      });
    });

    it('throws error if misconfigured', async () => {
      git.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      migrateAndValidate.migrateAndValidate.mockResolvedValueOnce({
        errors: [{ topic: 'dep', message: 'test error' }],
      });
      let e: Error;
      try {
        await mergeRenovateConfig(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.toString()).toBe('Error: config-validation');
    });

    it('migrates nested config', async () => {
      git.getFileList.mockResolvedValue(['renovate.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        warnings: [],
        errors: [],
      });
      migrate.migrateConfig.mockReturnValueOnce({
        isMigrated: true,
        migratedConfig: {},
      });
      config.extends = [':automergeDisabled'];
      expect(await mergeRenovateConfig(config)).toBeDefined();
    });

    it('continues if no errors', async () => {
      git.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        warnings: [],
        errors: [],
      });
      config.extends = [':automergeDisabled'];
      expect(await mergeRenovateConfig(config)).toBeDefined();
    });
  });
});
