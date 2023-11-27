import {
  RenovateConfig,
  fs,
  logger,
  mocked,
  partial,
  platform,
  scm,
} from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import * as _migrateAndValidate from '../../../config/migrate-validate';
import * as _migrate from '../../../config/migration';
import * as memCache from '../../../util/cache/memory';
import * as repoCache from '../../../util/cache/repository';
import { initRepoCache } from '../../../util/cache/repository/init';
import type { RepoCacheData } from '../../../util/cache/repository/types';
import * as _onboardingCache from '../onboarding/branch/onboarding-branch-cache';
import { OnboardingState } from '../onboarding/common';
import {
  checkForRepoConfigError,
  detectRepoFileConfig,
  mergeRenovateConfig,
} from './merge';

jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../onboarding/branch/onboarding-branch-cache');

const migrate = mocked(_migrate);
const migrateAndValidate = mocked(_migrateAndValidate);
const onboardingCache = mocked(_onboardingCache);

let config: RenovateConfig;

beforeEach(() => {
  memCache.init();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

jest.mock('../../../config/migration');
jest.mock('../../../config/migrate-validate');

describe('workers/repository/init/merge', () => {
  describe('detectRepoFileConfig()', () => {
    beforeEach(async () => {
      await initRepoCache({ repoFingerprint: '0123456789abcdef' });
      jest.restoreAllMocks();
    });

    it('returns config if not found', async () => {
      scm.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(await detectRepoFileConfig()).toEqual({});
    });

    it('returns config if not found - uses cache', async () => {
      jest
        .spyOn(repoCache, 'getCache')
        .mockReturnValueOnce(
          partial<RepoCacheData>({ configFileName: 'renovate.json' }),
        );
      platform.getRawFile.mockRejectedValueOnce(new Error());
      scm.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(await detectRepoFileConfig()).toEqual({});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Existing config file no longer exists',
      );
    });

    it('returns cache config from onboarding cache - package.json', async () => {
      const pJson = JSON.stringify({
        schema: 'https://docs.renovate.com',
      });
      OnboardingState.onboardingCacheValid = true;
      onboardingCache.getOnboardingFileNameFromCache.mockReturnValueOnce(
        'package.json',
      );
      onboardingCache.getOnboardingConfigFromCache.mockReturnValueOnce(pJson);
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'package.json',
        configFileParsed: { schema: 'https://docs.renovate.com' },
      });
    });

    it('clones, if onboarding cache is valid but parsed config is undefined', async () => {
      OnboardingState.onboardingCacheValid = true;
      onboardingCache.getOnboardingFileNameFromCache.mockReturnValueOnce(
        'package.json',
      );
      onboardingCache.getOnboardingConfigFromCache.mockReturnValueOnce(
        undefined as never,
      );
      scm.getFileList.mockResolvedValueOnce(['package.json']);
      const pJson = JSON.stringify({
        name: 'something',
        renovate: {
          prHourlyLimit: 10,
        },
      });
      fs.readLocalFile.mockResolvedValueOnce(pJson);
      platform.getRawFile.mockResolvedValueOnce(pJson);
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'package.json',
        configFileParsed: { prHourlyLimit: 10 },
      });
    });

    it('returns cache config from onboarding cache - renovate.json', async () => {
      const configParsed = JSON.stringify({
        schema: 'https://docs.renovate.com',
      });
      OnboardingState.onboardingCacheValid = true;
      onboardingCache.getOnboardingFileNameFromCache.mockReturnValueOnce(
        'renovate.json',
      );
      onboardingCache.getOnboardingConfigFromCache.mockReturnValueOnce(
        configParsed,
      );
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'renovate.json',
        configFileParsed: {
          schema: 'https://docs.renovate.com',
        },
        configFileRaw: undefined,
      });
    });

    it('uses package.json config if found', async () => {
      scm.getFileList.mockResolvedValue(['package.json']);
      const pJson = JSON.stringify({
        name: 'something',
        renovate: {
          prHourlyLimit: 10,
        },
      });
      fs.readLocalFile.mockResolvedValue(pJson);
      platform.getRawFile.mockResolvedValueOnce(pJson);
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'package.json',
        configFileParsed: { prHourlyLimit: 10 },
      });
      // get from repoCache
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'package.json',
        configFileParsed: { prHourlyLimit: 10 },
      });
    });

    it('massages package.json renovate string', async () => {
      scm.getFileList.mockResolvedValue(['package.json']);
      const pJson = JSON.stringify({
        name: 'something',
        renovate: 'github>renovatebot/renovate',
      });
      fs.readLocalFile.mockResolvedValue(pJson);
      platform.getRawFile.mockResolvedValueOnce(pJson);
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'package.json',
        configFileParsed: { extends: ['github>renovatebot/renovate'] },
      });
    });

    it('returns error if cannot parse', async () => {
      scm.getFileList.mockResolvedValue(['package.json', 'renovate.json']);
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
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc']);
      fs.readLocalFile.mockResolvedValue(
        '{ "enabled": true, "enabled": false }',
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
      const configFileRaw = `{
        // this is json5 format
      }`;
      scm.getFileList.mockResolvedValue(['package.json', 'renovate.json5']);
      fs.readLocalFile.mockResolvedValue(configFileRaw);
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: 'renovate.json5',
        configFileParsed: {},
        configFileRaw,
      });
    });

    it('finds .github/renovate.json', async () => {
      scm.getFileList.mockResolvedValue([
        'package.json',
        '.github/renovate.json',
      ]);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.github/renovate.json',
        configFileParsed: {},
        configFileRaw: '{}',
      });
    });

    it('finds .gitlab/renovate.json', async () => {
      scm.getFileList.mockResolvedValue([
        'package.json',
        '.gitlab/renovate.json',
      ]);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.gitlab/renovate.json',
        configFileParsed: {},
        configFileRaw: '{}',
      });
    });

    it('finds .renovaterc.json', async () => {
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      platform.getRawFile.mockResolvedValueOnce('{"something":"new"}');
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.renovaterc.json',
        configFileParsed: {},
        configFileRaw: '{}',
      });
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.renovaterc.json',
        configFileParsed: {
          something: 'new',
        },
        configFileRaw: '{"something":"new"}',
      });
    });

    it('finds .renovaterc.json5', async () => {
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc.json5']);
      fs.readLocalFile.mockResolvedValue('{}');
      platform.getRawFile.mockResolvedValueOnce('{"something":"new"}');
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.renovaterc.json5',
        configFileParsed: {},
        configFileRaw: '{}',
      });
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.renovaterc.json5',
        configFileParsed: {
          something: 'new',
        },
        configFileRaw: '{"something":"new"}',
      });
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
        }),
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
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      migrateAndValidate.migrateAndValidate.mockResolvedValueOnce({
        errors: [{ topic: 'dep', message: 'test error' }],
      });
      let e: Error | undefined;
      try {
        await mergeRenovateConfig(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e?.toString()).toBe('Error: config-validation');
    });

    it('migrates nested config', async () => {
      scm.getFileList.mockResolvedValue(['renovate.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      migrateAndValidate.migrateAndValidate.mockImplementation((_, c) => {
        // We shouldn't see packageRules here (avoids #14827).
        // (someday the validation should probably be reworked to know about `sourceUrl` from the repo config, but that day isn't today)
        expect(c).not.toHaveProperty('packageRules');
        return Promise.resolve({
          ...c,
          warnings: [],
          errors: [],
        });
      });
      migrate.migrateConfig.mockImplementation((c) => ({
        isMigrated: true,
        migratedConfig: c,
      }));
      config.extends = [':automergeAll'];
      config.packageRules = [{ extends: ['monorepo:react'] }];
      const ret = await mergeRenovateConfig(config);
      expect(ret).toMatchObject({
        automerge: true,
        packageRules: [
          {
            matchSourceUrls: ['https://github.com/facebook/react'],
          },
        ],
      });
    });

    it('ignores presets', async () => {
      scm.getFileList.mockResolvedValue(['renovate.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        extends: ['config:recommended'],
        warnings: [],
        errors: [],
      });
      migrate.migrateConfig.mockImplementation((c) => ({
        isMigrated: true,
        migratedConfig: c,
      }));
      config.extends = ['config:recommended'];
      config.ignorePresets = [':ignoreModulesAndTests'];
      config.ignorePaths = ['**/examples/**'];
      const res = await mergeRenovateConfig(config);
      expect(res.ignorePaths).toEqual(config.ignorePaths);
    });

    it('continues if no errors', async () => {
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        warnings: [],
        errors: [],
      });
      config.extends = [':automergeDisabled'];
      expect(await mergeRenovateConfig(config)).toBeDefined();
    });

    it('continues if no errors-2', async () => {
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        warnings: [],
        errors: [],
      });
      expect(
        await mergeRenovateConfig({
          ...config,
          requireConfig: 'ignored',
          configFileParsed: undefined,
          warnings: undefined,
          secrets: undefined,
        }),
      ).toBeDefined();
    });
  });
});
