import type { RenovateConfig } from '../../../../test/util';
import {
  fs,
  logger,
  mocked,
  partial,
  platform,
  scm,
} from '../../../../test/util';
import * as decrypt from '../../../config/decrypt';
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
  setNpmTokenInNpmrc,
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
      });
    });

    it('finds .renovaterc.json', async () => {
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      platform.getRawFile.mockResolvedValueOnce('{"something":"new"}');
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.renovaterc.json',
        configFileParsed: {},
      });
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.renovaterc.json',
        configFileParsed: {
          something: 'new',
        },
      });
    });

    it('finds .renovaterc.json5', async () => {
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc.json5']);
      fs.readLocalFile.mockResolvedValue('{}');
      platform.getRawFile.mockResolvedValueOnce('{"something":"new"}');
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.renovaterc.json5',
        configFileParsed: {},
      });
      expect(await detectRepoFileConfig()).toEqual({
        configFileName: '.renovaterc.json5',
        configFileParsed: {
          something: 'new',
        },
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

    it('uses onboarding config if silent', async () => {
      scm.getFileList.mockResolvedValue([]);
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        warnings: [],
        errors: [],
      });
      config.mode = 'silent';
      config.repository = 'some-org/some-repo';
      const res = await mergeRenovateConfig(config);
      expect(res).toBeDefined();
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

    it('sets npmToken to npmrc when it is not inside encrypted', async () => {
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue(
        '{"npmToken": "{{ secrets.NPM_TOKEN }}", "npmrc": "something_authToken=${NPM_TOKEN}"}',
      );
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        ...config,
        npmToken: '{{ secrets.NPM_TOKEN }}',
        npmrc: 'something_authToken=${NPM_TOKEN}',
        warnings: [],
        errors: [],
      });
      migrate.migrateConfig.mockImplementation((c) => ({
        isMigrated: true,
        migratedConfig: c,
      }));
      config.secrets = {
        NPM_TOKEN: 'confidential',
      };
      const res = await mergeRenovateConfig(config);
      expect(res.npmrc).toBe('something_authToken=confidential');
    });

    it('sets npmToken to npmrc when it is inside encrypted', async () => {
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue(
        '{"encrypted": { "npmToken": "encrypted-token" }, "npmrc": "something_authToken=${NPM_TOKEN}"}',
      );
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        ...config,
        npmrc: 'something_authToken=${NPM_TOKEN}',
        encrypted: {
          npmToken: 'encrypted-token',
        },
        warnings: [],
        errors: [],
      });
      migrate.migrateConfig.mockImplementation((c) => ({
        isMigrated: true,
        migratedConfig: c,
      }));
      jest.spyOn(decrypt, 'decryptConfig').mockResolvedValueOnce({
        ...config,
        npmrc: 'something_authToken=${NPM_TOKEN}',
        npmToken: 'token',
      });
      const res = await mergeRenovateConfig(config);
      expect(res.npmrc).toBe('something_authToken=token');
    });
  });

  describe('setNpmTokenInNpmrc', () => {
    it('skips in no npmToken found', () => {
      const config = {};
      setNpmTokenInNpmrc(config);
      expect(config).toMatchObject({});
    });

    it('adds default npmrc registry if it does not exist', () => {
      const config = { npmToken: 'token' };
      setNpmTokenInNpmrc(config);
      expect(config).toMatchObject({
        npmrc: '//registry.npmjs.org/:_authToken=token\n',
      });
    });

    it('adds npmToken at end of npmrc string if ${NPM_TOKEN} string not found', () => {
      const config = { npmToken: 'token', npmrc: 'something\n' };
      setNpmTokenInNpmrc(config);
      expect(config).toMatchObject({ npmrc: 'something\n_authToken=token\n' });
    });

    it('replaces ${NPM_TOKEN} with npmToken value', () => {
      const config = {
        npmToken: 'token',
        npmrc: 'something_auth=${NPM_TOKEN}\n',
      };
      setNpmTokenInNpmrc(config);
      expect(config).toMatchObject({ npmrc: 'something_auth=token\n' });
    });
  });
});
