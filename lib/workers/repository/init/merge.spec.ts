import { isNullOrUndefined } from '@sindresorhus/is';
import { codeBlock } from 'common-tags';
import type { MockInstance } from 'vitest';
import type { RenovateConfig } from '~test/util.ts';
import { fs, logger, partial, platform, scm } from '~test/util.ts';
import * as decrypt from '../../../config/decrypt.ts';
import { getConfig } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as _migrateAndValidate from '../../../config/migrate-validate.ts';
import * as _migrate from '../../../config/migration.ts';
import type { AllConfig } from '../../../config/types.ts';
import * as configValidation from '../../../config/validation.ts';
import * as npmApi from '../../../modules/datasource/npm/index.ts';
import type { HostRule } from '../../../types/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as repoCache from '../../../util/cache/repository/index.ts';
import { initRepoCache } from '../../../util/cache/repository/init.ts';
import type { RepoCacheData } from '../../../util/cache/repository/types.ts';
import { getUserEnv } from '../../../util/env.ts';
import * as hostRules from '../../../util/host-rules.ts';
import * as queue from '../../../util/http/queue.ts';
import * as throttle from '../../../util/http/throttle.ts';
import * as _onboardingCache from '../onboarding/branch/onboarding-branch-cache.ts';
import { OnboardingState } from '../onboarding/common.ts';
import {
  applyHostRules,
  applyNpmrc,
  checkForRepoConfigError,
  detectRepoFileConfig,
  mergeRenovateConfig,
  resolveStaticRepoConfig,
  setNpmTokenInNpmrc,
} from './merge.ts';
import type { RepositoryWorkerConfig } from './types.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../onboarding/branch/config.ts');
vi.mock('../onboarding/branch/onboarding-branch-cache.ts');

const migrate = vi.mocked(_migrate);
const migrateAndValidate = vi.mocked(_migrateAndValidate);
const onboardingCache = vi.mocked(_onboardingCache);

let config: RenovateConfig;

function mockProcessExitOnce(): [MockInstance<NodeJS.Process['exit']>, Error] {
  const mockedError = new Error('mocked exit called');

  return [
    vi.spyOn(process, 'exit').mockImplementationOnce(() => {
      throw mockedError;
    }),
    mockedError,
  ];
}

beforeEach(() => {
  memCache.init();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

// only `migrateConfig` needs mocking
vi.mock('../../../config/migration.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof _migrate>()),
  migrateConfig: vi.fn(),
}));
vi.mock('../../../config/migrate-validate.ts');

describe('workers/repository/init/merge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    hostRules.clear();
    GlobalConfig.reset();
  });

  describe('detectRepoFileConfig()', () => {
    beforeEach(async () => {
      await initRepoCache({ repoFingerprint: '0123456789abcdef' });
    });

    it('returns config if not found', async () => {
      scm.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(await detectRepoFileConfig()).toEqual({});
    });

    it('returns config if not found - uses cache', async () => {
      vi.spyOn(repoCache, 'getCache').mockReturnValueOnce(
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
        undefined,
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
      const configFileRaw = codeBlock`
        {
                // this is json5 format
              }
      `;
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
      ).toThrow('config-validation');
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
            matchSourceUrls: [
              'https://github.com/facebook/react',
              'https://github.com/react/react',
            ],
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
      GlobalConfig.set({ requireConfig: 'ignored' });
      expect(
        await mergeRenovateConfig({
          ...config,
          requireConfig: 'ignored',
          // @ts-expect-error -- TODO: do we still need this?
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
      vi.spyOn(decrypt, 'decryptConfig').mockResolvedValueOnce({
        ...config,
        npmrc: 'something_authToken=${NPM_TOKEN}',
        npmToken: 'token',
      });
      const res = await mergeRenovateConfig(config);
      expect(res.npmrc).toBe('something_authToken=token');
    });

    it('deletes user conifgured env after setting in mem cache', async () => {
      GlobalConfig.set({ allowedEnv: ['var'] });
      scm.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{"env": { "var": "value" }}');
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        ...config,
        env: {
          var: 'value',
        },
        warnings: [],
        errors: [],
      });
      migrate.migrateConfig.mockImplementation((c) => ({
        isMigrated: true,
        migratedConfig: c,
      }));
      const res = await mergeRenovateConfig(config);
      expect(res.env).toBeUndefined();
      expect(getUserEnv()).toEqual({
        var: 'value',
      });
    });

    it('applies repositoryEntryConfig between global and repo file config', async () => {
      migrateAndValidate.migrateAndValidate.mockImplementation((_, c) =>
        Promise.resolve({ ...c, warnings: [], errors: [] }),
      );
      migrate.migrateConfig.mockImplementation((c) => ({
        isMigrated: true,
        migratedConfig: c,
      }));

      const setNpmrcSpy = vi.spyOn(npmApi, 'setNpmrc');
      const npmrcValue = '//registry.npmjs.org/:_authToken=preset-token\n';

      const globalPresetRule = {
        matchPackageNames: ['globalPresetDep'],
        enabled: false,
      };
      const ignoredByGlobalRule = {
        matchPackageNames: ['ignoredByGlobalDep'],
        enabled: false,
      };
      const ignoredByEntryRule = {
        matchPackageNames: ['ignoredByEntryDep'],
        enabled: false,
      };
      const ignoredByRepoRule = {
        matchPackageNames: ['ignoredByRepoDep'],
        enabled: false,
      };
      const repoEntryPresetRule = {
        matchPackageNames: ['repoEntryPresetDep'],
        enabled: false,
      };
      const repoFilePresetRule = {
        matchPackageNames: ['repoFilePresetDep'],
        enabled: false,
      };
      const globalRule = {
        matchPackageNames: ['globalDep'],
        enabled: false,
      };
      const repoEntryRule = {
        matchPackageNames: ['repoEntryDep'],
        enabled: false,
      };
      const repoFileRule = {
        matchPackageNames: ['repoFileDep'],
        enabled: false,
      };

      memCache.set('preset:local>globalPreset', {
        packageRules: [globalPresetRule],
        hostRules: [
          {
            matchHost: 'https://npm.example.com',
            token: '{{ secrets.HOST_TOKEN }}',
          },
        ],
        npmrc: npmrcValue,
      });
      memCache.set('preset:local>ignoredByGlobal', {
        packageRules: [ignoredByGlobalRule],
      });
      memCache.set('preset:local>ignoredByEntry', {
        packageRules: [ignoredByEntryRule],
      });
      memCache.set('preset:local>ignoredByRepo', {
        packageRules: [ignoredByRepoRule],
      });
      memCache.set('preset:local>repoEntryPreset', {
        packageRules: [repoEntryPresetRule],
      });
      memCache.set('preset:local>repoFilePreset', {
        packageRules: [repoFilePresetRule],
      });

      scm.getFileList.mockResolvedValue(['renovate.json']);
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({
          extends: ['local>repoFilePreset'],
          ignorePresets: ['local>ignoredByRepo'],
          packageRules: [repoFileRule],
        }),
      );

      const inputConfig: RepositoryWorkerConfig = {
        ...config,
        extends: [
          'local>globalPreset',
          'local>ignoredByGlobal',
          'local>ignoredByEntry',
          'local>ignoredByRepo',
        ],
        ignorePresets: ['local>ignoredByGlobal'],
        packageRules: [globalRule],
        secrets: { HOST_TOKEN: 'resolved-secret-token' },
        repositoryEntryConfig: {
          extends: ['local>repoEntryPreset'],
          ignorePresets: ['local>ignoredByEntry'],
          packageRules: [repoEntryRule],
        },
      };

      const res = await mergeRenovateConfig(inputConfig);

      expect(res.packageRules).toMatchObject([
        globalRule,
        globalPresetRule,
        // ignoredByGlobalRule should not be here
        // ignoredByEntryRule should not be here
        // ignoredByRepoRule should not be here
        repoEntryPresetRule,
        repoEntryRule,
        repoFilePresetRule,
        repoFileRule,
      ]);

      expect(hostRules.find({ url: 'https://npm.example.com' })).toMatchObject({
        token: 'resolved-secret-token',
      });

      expect(setNpmrcSpy).toHaveBeenCalledWith(npmrcValue);
    });

    it('supports repositoryEntryConfig without extends or ignorePresets', async () => {
      migrateAndValidate.migrateAndValidate.mockImplementation((_, c) =>
        Promise.resolve({ ...c, warnings: [], errors: [] }),
      );
      migrate.migrateConfig.mockImplementation((c) => ({
        isMigrated: true,
        migratedConfig: c,
      }));

      const repoEntryRule = {
        matchPackageNames: ['repoEntryDep'],
        enabled: false,
      };

      scm.getFileList.mockResolvedValue([]);
      fs.readLocalFile.mockResolvedValue(null);

      const inputConfig: RepositoryWorkerConfig = {
        ...config,
        extends: undefined,
        ignorePresets: undefined,
        repositoryEntryConfig: {
          packageRules: [repoEntryRule],
        },
      };

      const res = await mergeRenovateConfig(inputConfig);

      expect(res.packageRules).toMatchObject([repoEntryRule]);
    });

    describe('allowedEnv', () => {
      beforeEach(() => {
        migrateAndValidate.migrateAndValidate.mockImplementation((_, c) =>
          Promise.resolve({ ...c, warnings: [], errors: [] }),
        );
        migrate.migrateConfig.mockImplementation((c) => ({
          isMigrated: false,
          migratedConfig: c,
        }));
        scm.getFileList.mockResolvedValue(['renovate.json']);
      });

      it('applies `env` from the repository config, if in `allowedEnv`', async () => {
        GlobalConfig.set({ allowedEnv: ['SOME_*'] });
        fs.readLocalFile.mockResolvedValue(
          JSON.stringify({ env: { SOME_VAR: 'from-repo' } }),
        );

        await mergeRenovateConfig(config);

        expect(getUserEnv()).toEqual({ SOME_VAR: 'from-repo' });
      });

      it('applies `env` from a `repositories[]` entry, if it is NOT in `allowedEnv`', async () => {
        // self-hosted administrators' `repositories[].env` are not restricted by `allowedEnv`, and are intentionally treated as "safe"
        GlobalConfig.set({ allowedEnv: ['SOME_*'] });
        fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

        await mergeRenovateConfig({
          ...config,
          repositoryEntryConfig: { env: { ADMIN_VAR: 'from-admin' } },
        });

        expect(getUserEnv()).toEqual({ ADMIN_VAR: 'from-admin' });
      });

      it('rejects `env` injected by a repository, if it is not in `allowedEnv`', async () => {
        // previously this would be filtered (with a WARN log), but now leads to a config validation error
        // the repo file's own violation is caught by the first validation pass (`migrateAndValidate`) - the resolved-config pass only re-runs when preset resolution or decryption changed something - so that pass must be real here
        const { migrateAndValidate: actualMigrateAndValidate } =
          await vi.importActual<typeof _migrateAndValidate>(
            '../../../config/migrate-validate.ts',
          );
        migrateAndValidate.migrateAndValidate.mockImplementation(
          actualMigrateAndValidate,
        );
        GlobalConfig.set({ allowedEnv: ['SOME_*'] });
        fs.readLocalFile.mockResolvedValue(
          JSON.stringify({ env: { NOT_ALLOWED: 'from-repo' } }),
        );

        await expect(mergeRenovateConfig(config)).rejects.toMatchObject({
          message: 'config-validation',
          validationSource: 'renovate.json',
          validationMessage:
            "Env variable name `NOT_ALLOWED` is not allowed by this Renovate instance's `allowedEnv`.",
        });
        expect(getUserEnv()).toEqual({});
      });

      it('rejects `env` injected by a preset, if it is not in `allowedEnv`', async () => {
        // previously this would be filtered (with a WARN log), but now leads to a config validation error
        GlobalConfig.set({ allowedEnv: ['SOME_*'] });
        memCache.set('preset:local>envPreset', {
          env: { NOT_ALLOWED: 'from-preset' },
        });
        fs.readLocalFile.mockResolvedValue(
          JSON.stringify({ extends: ['local>envPreset'] }),
        );

        await expect(mergeRenovateConfig(config)).rejects.toMatchObject({
          message: 'config-validation',
          validationSource: 'renovate.json',
          validationMessage:
            "Env variable name `NOT_ALLOWED` is not allowed by this Renovate instance's `allowedEnv`.",
        });
        expect(getUserEnv()).toEqual({});
      });

      it('applies `env` from `GlobalConfig`, even if it is NOT in `allowedEnv`', async () => {
        GlobalConfig.set({
          allowedEnv: ['SOME_*'],
        });
        fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

        await mergeRenovateConfig({
          ...config,
          env: { ADMIN_VAR: 'from-config.js' },
        });

        expect(getUserEnv()).toEqual({ ADMIN_VAR: 'from-config.js' });
      });
    });

    describe('allowedHeaders', () => {
      beforeEach(() => {
        migrateAndValidate.migrateAndValidate.mockImplementation((_, c) =>
          Promise.resolve({ ...c, warnings: [], errors: [] }),
        );
        migrate.migrateConfig.mockImplementation((c) => ({
          isMigrated: false,
          migratedConfig: c,
        }));
        scm.getFileList.mockResolvedValue(['renovate.json']);
      });

      it('applies `hostRules` headers from the repository config within `allowedHeaders`', async () => {
        GlobalConfig.set({ allowedHeaders: ['X-*'] });
        fs.readLocalFile.mockResolvedValue(
          JSON.stringify({
            hostRules: [
              {
                matchHost: 'registry.example.com',
                headers: { 'X-Allowed': 'from-repo' },
              },
            ],
          }),
        );

        await mergeRenovateConfig(config);

        expect(hostRules.find({ url: 'https://registry.example.com' })).toEqual(
          { headers: { 'X-Allowed': 'from-repo' } },
        );
      });

      it("applies a `repositories[]` entry's `hostRules` in full", async () => {
        GlobalConfig.set({ allowedHeaders: ['X-*', 'custom-header'] });
        fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

        await mergeRenovateConfig({
          ...config,
          secrets: { TOKEN: 'admin-secret' },
          repositoryEntryConfig: {
            hostRules: [
              {
                matchHost: 'registry.example.com',
                token: '{{ secrets.TOKEN }}',
                headers: {
                  'custom-header': 'Bearer {{ secrets.TOKEN }}',
                  'X-Allowed': 'yes',
                },
              },
            ],
          },
        });

        expect(hostRules.find({ url: 'https://registry.example.com' })).toEqual(
          {
            token: 'admin-secret',
            headers: {
              'custom-header': 'Bearer admin-secret',
              'X-Allowed': 'yes',
            },
          },
        );
      });

      it('drops `repositories[]` entry headers, if it is not in `allowedHeaders`', async () => {
        // previously this would apply due to a gap in re-validating `allowedHeaders` against the resolved config.
        // `applyHostRules` filters by header name at request time, so this does not reach the final HTTP call, but we should make sure this also doesn't break
        GlobalConfig.set({ allowedHeaders: ['X-*'] });
        fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

        await mergeRenovateConfig({
          ...config,
          repositoryEntryConfig: {
            hostRules: [
              {
                matchHost: 'registry.example.com',
                headers: { Authorization: 'from-admin' },
              },
            ],
          },
        });

        expect(hostRules.find({ url: 'https://registry.example.com' })).toEqual(
          {},
        );
        expect(logger.logger.warn).toHaveBeenCalledWith(
          { denied: ['Authorization'] },
          "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
        );
      });

      it('rejects `hostRules` headers injected by a preset, if it is not in `allowedHeaders`', async () => {
        // previously this would be filtered (with a WARN log), but now leads to a config validation error
        GlobalConfig.set({ allowedHeaders: ['X-*'] });
        memCache.set('preset:local>headerPreset', {
          hostRules: [
            {
              matchHost: 'registry.example.com',
              headers: { Authorization: 'from-preset' },
            },
          ],
        });
        fs.readLocalFile.mockResolvedValue(
          JSON.stringify({ extends: ['local>headerPreset'] }),
        );

        await expect(mergeRenovateConfig(config)).rejects.toMatchObject({
          message: 'config-validation',
          validationSource: 'renovate.json',
          validationError:
            'The Renovate configuration file contains some invalid settings',
          validationMessage:
            "hostRules header `Authorization` is not allowed by this Renovate instance's `allowedHeaders`.",
        });
        expect(hostRules.find({ url: 'https://registry.example.com' })).toEqual(
          {},
        );
      });
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

  describe('applyNpmrc', () => {
    it('does nothing if npmrc is missing after token migration', () => {
      const setNpmrcSpy = vi.spyOn(npmApi, 'setNpmrc');

      applyNpmrc({});

      expect(setNpmrcSpy).not.toHaveBeenCalled();
    });

    it('migrates npmToken and sets npmrc', () => {
      const setNpmrcSpy = vi.spyOn(npmApi, 'setNpmrc');
      const config = {
        npmToken: 'token',
        npmrc: 'something_authToken=${NPM_TOKEN}',
      };

      applyNpmrc(config);

      expect(config.npmToken).toBeUndefined();
      expect(config.npmrc).toBe('something_authToken=token');
      expect(setNpmrcSpy).toHaveBeenCalledExactlyOnceWith(
        'something_authToken=token',
      );
    });
  });

  describe('resolved config validation', () => {
    beforeEach(() => {
      migrateAndValidate.migrateAndValidate.mockImplementation((_, c) =>
        Promise.resolve({ ...c, warnings: [], errors: [] }),
      );
      migrate.migrateConfig.mockImplementation((c) => ({
        isMigrated: false,
        migratedConfig: c,
      }));
      scm.getFileList.mockResolvedValue(['renovate.json']);
    });

    it('applies env a repositories[] entry preset contributes', async () => {
      // the entry, and everything the presets it extends contribute, is the self-hosted admin's own config, so `allowedEnv` does not constrain it
      memCache.set('preset:local>entryInjectsEnv', {
        env: { NODE_OPTIONS: '--require /tmp/from-admin.js' },
      });
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: { extends: ['local>entryInjectsEnv'] },
      });

      expect(res).toBeDefined();
      expect(getUserEnv()).toEqual({
        NODE_OPTIONS: '--require /tmp/from-admin.js',
      });
      expect(logger.logger.warn).not.toHaveBeenCalledWith(
        expect.anything(),
        "Ignoring env variables not permitted by this Renovate instance's `allowedEnv`",
      );
    });

    it("reports a repository preset replaying the admin's header to a host of its own choosing", async () => {
      // the `matchHost` is part of a header's identity, so the same name and value against a different host is the preset's own header, not the self-hosted admin's
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      memCache.set('preset:local>replaysHeader', {
        hostRules: [
          {
            matchHost: 'evil.example.com',
            headers: { Authorization: 'admin-secret' },
          },
        ],
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>replaysHeader'] }),
      );

      await expect(
        mergeRenovateConfig({
          ...config,
          hostRules: [
            {
              matchHost: 'admin.example.com',
              headers: { Authorization: 'admin-secret' },
            },
          ],
        }),
      ).rejects.toMatchObject({
        message: 'config-validation',
        validationSource: 'renovate.json',
        validationMessage:
          "hostRules header `Authorization` is not allowed by this Renovate instance's `allowedHeaders`.",
      });
    });

    it("exempts a repository preset narrowing the admin's host-less header to one host", async () => {
      // the self-hosted admin's own catch-all header already reaches that host, so scoping it narrower is not the preset introducing one of its own
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      memCache.set('preset:local>narrowsHeader', {
        hostRules: [
          {
            matchHost: 'registry.example.com',
            headers: { Authorization: 'admin-secret' },
          },
        ],
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>narrowsHeader'] }),
      );

      await expect(
        mergeRenovateConfig({
          ...config,
          hostRules: [{ headers: { Authorization: 'admin-secret' } }],
        }),
      ).toResolve();
    });

    it('migrates a legacy option name in a repositories[] entry before validating it', async () => {
      // unmigrated, `renovateFork` is not a known option, so `validateConfig` reports it as invalid - and `configValidationError` turns that into a failed repository
      const { migrateConfig } = await vi.importActual<typeof _migrate>(
        '../../../config/migration.ts',
      );
      migrate.migrateConfig.mockImplementation(migrateConfig);
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        configValidationError: true,
        // oxlint-disable-next-line renovate/prefer-partial-in-specs -- a legacy option name, so deliberately absent from `RenovateConfig`
        repositoryEntryConfig: { renovateFork: true } as RenovateConfig,
      });

      expect(res.forkProcessing).toBe('enabled');
    });

    it('validates a resolved config whose options migration left as strings', async () => {
      // `validateConfig` assumes `allowString` options are already arrays, which only `massageConfig` guarantees
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ schedule: 'before 5am' }),
      );

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {},
      });

      expect(res.schedule).toBe('before 5am');
    });

    it('applies only top-level env, and does not fail for a nested one', async () => {
      // guards the claim the topic choice rests on: only the top-level value of a requiresCheckAtTrustBoundary option is ever applied, so a nested one is inert and must not abort the repository
      GlobalConfig.set({ allowedEnv: ['ALLOWED_*'] });
      memCache.set('preset:local>nestsEnv', {
        env: { ALLOWED_VAR: 'top-level' },
        packageRules: [
          {
            matchManagers: ['npm'],
            env: { GIT_SSH_COMMAND: 'sh -c "malicious"' },
          },
        ],
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>nestsEnv'] }),
      );

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {},
      });

      expect(res).toBeDefined();
      expect(getUserEnv()).toEqual({ ALLOWED_VAR: 'top-level' });
    });

    it('applies only top-level hostRules, and does not fail for a nested one', async () => {
      GlobalConfig.set({ allowedHeaders: ['custom-*'] });
      memCache.set('preset:local>nestsHostRules', {
        hostRules: [
          {
            matchHost: 'top-level.example.com',
            headers: { 'custom-token': 'token' },
          },
        ],
        packageRules: [
          {
            matchManagers: ['npm'],
            hostRules: [
              {
                matchHost: 'nested.example.com',
                headers: { 'custom-token': 'token' },
              },
            ],
          },
        ],
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>nestsHostRules'] }),
      );

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {},
      });

      expect(res).toBeDefined();
      expect(
        hostRules.find({ url: 'https://top-level.example.com' }),
      ).toMatchObject({ headers: { 'custom-token': 'token' } });
      expect(
        hostRules.find({ url: 'https://nested.example.com' }).headers,
      ).toBeUndefined();
    });

    it('exempts env the self-hosted admin supplied from allowedEnv', async () => {
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        env: { ADMIN_VAR: 'set-by-admin' },
        repositoryEntryConfig: {},
      });

      expect(res).toBeDefined();
      expect(getUserEnv()).toEqual({ ADMIN_VAR: 'set-by-admin' });
      expect(logger.logger.warn).not.toHaveBeenCalledWith(
        expect.anything(),
        "Ignoring env variables not permitted by this Renovate instance's `allowedEnv`",
      );
    });

    it('exempts env and headers supplied by the repositories[] entry itself', async () => {
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {
          env: { ENTRY_VAR: 'set-by-admin' },
          hostRules: [
            {
              matchHost: 'registry.example.com',
              headers: { 'custom-token': 'token' },
            },
          ],
        },
      });

      expect(res).toBeDefined();
      expect(getUserEnv()).toEqual({ ENTRY_VAR: 'set-by-admin' });
    });

    it("applies a repositories[] entry's header over one the admin set globally", async () => {
      // the entry is the admin's own config, so its rules are registered `trusted` too - otherwise an admin could not override, for a single repository, a header they set for every one of them
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      hostRules.add(
        {
          matchHost: 'registry.example.com',
          headers: { 'X-Token': 'for-every-repo' },
        },
        { trusted: true },
      );
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {
          hostRules: [
            {
              matchHost: 'registry.example.com',
              headers: { 'X-Token': 'for-this-repo' },
            },
          ],
        },
      });

      expect(res).toBeDefined();
      expect(
        hostRules.find({ url: 'https://registry.example.com' }),
      ).toMatchObject({ headers: { 'X-Token': 'for-this-repo' } });
    });

    it('keeps going when a repositories[] entry carries a hostRule migration cannot migrate', async () => {
      // `hostRules` migration throws for a rule with more than one host-matching field: `applyHostRules` drops just that rule and carries on, so migrating the entry as a whole must not abort the repository instead
      const { migrateConfig } = await vi.importActual<typeof _migrate>(
        '../../../config/migration.ts',
      );
      migrate.migrateConfig.mockImplementation(migrateConfig);
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {
          hostRules: [
            // oxlint-disable-next-line renovate/prefer-partial-in-specs -- a legacy spelling, so deliberately absent from `HostRule`
            {
              matchHost: 'registry.example.com',
              hostName: 'other.example.com',
            } as HostRule,
          ],
        },
      });

      expect(res).toBeDefined();
      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        'Error migrating config',
      );
      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        'Error setting hostRule from config',
      );
    });

    it('drops, rather than rejects, a header a repositories[] entry preset contributes outside `allowedHeaders`', async () => {
      // the entry's presets are the admin's own config, so this is not a violation to abort the repository over - but `allowedHeaders` binds the admin too, and `applyHostRule` would drop the header at request time regardless, so it is dropped at registration with a WARN
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      memCache.set('preset:local>entryInjectsHeader', {
        hostRules: [
          { matchHost: 'github.com', headers: { Authorization: 'Bearer x' } },
        ],
      });
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {
          extends: ['local>entryInjectsHeader'],
          hostRules: [
            {
              matchHost: 'registry.example.com',
              headers: { 'X-Token': 'token' },
            },
          ],
        },
      });

      expect(res).toBeDefined();
      expect(
        hostRules.find({ url: 'https://github.com' }).headers,
      ).toBeUndefined();
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { denied: ['Authorization'] },
        "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
      );
    });

    it('treats non-security resolved-preset issues as advisory by default', async () => {
      memCache.set('preset:local>injectsInvalid', { notARealOption: true });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>injectsInvalid'] }),
      );

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {},
      });

      expect(res).toBeDefined();
    });

    it('escalates non-security resolved-preset issues to fatal under configValidationError', async () => {
      memCache.set('preset:local>injectsInvalid', { notARealOption: true });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>injectsInvalid'] }),
      );

      await expect(
        mergeRenovateConfig({
          ...config,
          configValidationError: true,
          repositoryEntryConfig: {},
        }),
      ).rejects.toMatchObject({
        message: 'config-validation',
        validationMessage: expect.stringContaining(
          'Invalid configuration option: notARealOption',
        ),
      });
    });

    it("exempts the admin's own header when migration rewrites their matchHost", async () => {
      // `adminSuppliedValues` must compare migrated spellings: the resolved config only ever contains the migrated `matchHost` (massaged to a full URL), so building the exemption keys from the admin's unmigrated config would report their own header as a violation
      const { migrateConfig } = await vi.importActual<typeof _migrate>(
        '../../../config/migration.ts',
      );
      migrate.migrateConfig.mockImplementation(migrateConfig);
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      memCache.set('preset:local>replaysAdminHost', {
        hostRules: [
          {
            matchHost: 'nexus.example.com:8443',
            headers: { Authorization: 'from-admin' },
          },
        ],
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>replaysAdminHost'] }),
      );

      await expect(
        mergeRenovateConfig({
          ...config,
          hostRules: [
            {
              matchHost: 'nexus.example.com:8443',
              headers: { Authorization: 'from-admin' },
            },
          ],
        }),
      ).toResolve();
    });

    it("reports a preset replaying the admin's legacy `hostName` header against a host of its own choosing", async () => {
      // a legacy `hostName` migrates to a `matchHost`, so the exemption key must be host-scoped: indexing the admin's unmigrated config would record the header host-less, wrongly exempting a preset replaying it against another host
      const { migrateConfig } = await vi.importActual<typeof _migrate>(
        '../../../config/migration.ts',
      );
      migrate.migrateConfig.mockImplementation(migrateConfig);
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      memCache.set('preset:local>replaysLegacyHeader', {
        hostRules: [
          {
            matchHost: 'evil.example.com',
            headers: { Authorization: 'admin-secret' },
          },
        ],
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>replaysLegacyHeader'] }),
      );

      await expect(
        mergeRenovateConfig({
          ...config,
          hostRules: [
            // oxlint-disable-next-line renovate/prefer-partial-in-specs -- a legacy spelling, so deliberately absent from `HostRule`
            {
              hostName: 'admin.example.com',
              headers: { Authorization: 'admin-secret' },
            } as HostRule,
          ],
        }),
      ).rejects.toMatchObject({
        message: 'config-validation',
        validationSource: 'renovate.json',
        validationMessage:
          "hostRules header `Authorization` is not allowed by this Renovate instance's `allowedHeaders`.",
      });
    });

    it("applies env the admin's global `extends` contributes", async () => {
      // presets in the global config's `extends` resolve on the repository path, mixed in with the repository's own, so they are resolved separately to tell them apart: what the admin chose to extend is their config, and a repository which merely inherits it must neither be blamed for it nor have it filtered out
      memCache.set('preset:local>adminExtends', {
        env: { CORP_VAR: 'from-admin-preset' },
      });
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        extends: ['local>adminExtends'],
      });

      expect(res).toBeDefined();
      expect(getUserEnv()).toEqual({ CORP_VAR: 'from-admin-preset' });
      expect(logger.logger.warn).not.toHaveBeenCalledWith(
        expect.anything(),
        "Ignoring env variables not permitted by this Renovate instance's `allowedEnv`",
      );
    });

    it("still reports env a repository's own preset injects alongside the admin's global `extends`", async () => {
      // the admin's exemption covers only what their own presets contributed
      memCache.set('preset:local>adminExtends', {
        env: { CORP_VAR: 'from-admin-preset' },
      });
      memCache.set('preset:local>repoExtends', {
        env: { NOT_ALLOWED: 'from-repo-preset' },
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>repoExtends'] }),
      );

      await expect(
        mergeRenovateConfig({ ...config, extends: ['local>adminExtends'] }),
      ).rejects.toMatchObject({
        message: 'config-validation',
        validationSource: 'renovate.json',
        validationMessage:
          "Env variable name `NOT_ALLOWED` is not allowed by this Renovate instance's `allowedEnv`.",
      });
    });

    it("continues without the exemption when the admin's global `extends` cannot be resolved", async () => {
      // resolving them here only builds the exemption; the resolution whose result is actually used reports the failure, so it must not be reported twice - nor first
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      await expect(
        mergeRenovateConfig({ ...config, extends: ['default:doesNotExist'] }),
      ).rejects.toMatchObject({ message: 'config-validation' });

      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.anything(),
        'Error resolving the self-hosted config presets - continuing without their exemption',
      );
    });

    it("applies a repositories[] entry's env that uses entry-level secrets", async () => {
      // the entry's secrets only interpolate as the entry is applied (there is no earlier global pass when the secrets are not defined globally), so the admin-supplied env snapshot must carry the interpolated value
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {
          env: { NPM_TOKEN: '{{ secrets.TOKEN }}' },
          secrets: { TOKEN: 'real-value' },
        },
      });

      expect(res).toBeDefined();
      expect(getUserEnv()).toEqual({ NPM_TOKEN: 'real-value' });
      expect(logger.logger.warn).not.toHaveBeenCalledWith(
        expect.anything(),
        "Ignoring env variables not permitted by this Renovate instance's `allowedEnv`",
      );
    });

    it("exempts a preset re-spelling the admin's matchHost with a scheme", async () => {
      // 'registry.example.com' and 'https://registry.example.com' match the same requests, so the same header against either spelling is still the admin's own
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      memCache.set('preset:local>respellsHost', {
        hostRules: [
          {
            matchHost: 'https://registry.example.com',
            headers: { Authorization: 'admin-secret' },
          },
        ],
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>respellsHost'] }),
      );

      await expect(
        mergeRenovateConfig({
          ...config,
          hostRules: [
            {
              matchHost: 'registry.example.com',
              headers: { Authorization: 'admin-secret' },
            },
          ],
        }),
      ).toResolve();
    });

    it("exempts a preset narrowing the admin's matchHost to a subpath", async () => {
      // the admin's own header already reaches every request under the wider host, so a narrower scope introduces nothing new
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      memCache.set('preset:local>narrowsToPath', {
        hostRules: [
          {
            matchHost: 'https://registry.example.com/npm/',
            headers: { Authorization: 'admin-secret' },
          },
        ],
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>narrowsToPath'] }),
      );

      await expect(
        mergeRenovateConfig({
          ...config,
          hostRules: [
            {
              matchHost: 'https://registry.example.com',
              headers: { Authorization: 'admin-secret' },
            },
          ],
        }),
      ).toResolve();
    });

    it("reports a preset broadening the admin's header to a wider host", async () => {
      // the admin scoped the header to a subpath; replaying it at the origin reaches requests the admin's rule does not
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      memCache.set('preset:local>broadensHost', {
        hostRules: [
          {
            matchHost: 'https://registry.example.com',
            headers: { Authorization: 'admin-secret' },
          },
        ],
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>broadensHost'] }),
      );

      await expect(
        mergeRenovateConfig({
          ...config,
          hostRules: [
            {
              matchHost: 'https://registry.example.com/npm/',
              headers: { Authorization: 'admin-secret' },
            },
          ],
        }),
      ).rejects.toMatchObject({
        message: 'config-validation',
        validationSource: 'renovate.json',
        validationMessage:
          "hostRules header `Authorization` is not allowed by this Renovate instance's `allowedHeaders`.",
      });
    });

    it('attributes a resolved-config violation to `config` when the repository has no config file', async () => {
      // the static repository config applies as repository config, but is not one of the repository's own files, so there is nothing to blame the failure on
      memCache.set('preset:local>injectsEnvNoFile', {
        env: { NOT_ALLOWED: 'from-preset' },
      });
      scm.getFileList.mockResolvedValue([]);
      fs.readSystemFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>injectsEnvNoFile'] }),
      );
      vi.stubEnv('RENOVATE_X_STATIC_REPO_CONFIG_FILE', 'static-config.json');

      await expect(mergeRenovateConfig({ ...config })).rejects.toMatchObject({
        message: 'config-validation',
        validationSource: 'config',
        validationMessage:
          "Env variable name `NOT_ALLOWED` is not allowed by this Renovate instance's `allowedEnv`.",
      });
    });

    it('rejects env a preset nests under `force`', async () => {
      // `validateConfig` demotes `force` sub-validation findings to warnings, but `mergeChildConfig` promotes `force` values into the applied config, so Security findings there must stay fatal
      memCache.set('preset:local>forcesEnv', {
        force: { env: { GIT_SSH_COMMAND: 'sh -c "malicious"' } },
      });
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ extends: ['local>forcesEnv'] }),
      );

      await expect(
        mergeRenovateConfig({ ...config, repositoryEntryConfig: {} }),
      ).rejects.toMatchObject({
        message: 'config-validation',
        validationSource: 'renovate.json',
        validationMessage:
          "Env variable name `GIT_SSH_COMMAND` is not allowed by this Renovate instance's `allowedEnv`.",
      });
    });

    it('exempts `force` env supplied by the repositories[] entry itself', async () => {
      // the harmless preset makes the resolved entry differ from the entry, so validation is not skipped as a no-op
      memCache.set('preset:local>harmlessLabels', { labels: ['from-preset'] });
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {
          extends: ['local>harmlessLabels'],
          force: { env: { ENTRY_FORCED: 'yes' } },
        },
      });

      expect(res).toBeDefined();
      expect(getUserEnv()).toEqual({ ENTRY_FORCED: 'yes' });
    });

    it("applies a repositories[] entry's `force.env` that uses entry-level secrets", async () => {
      // as with the entry's top-level `env`, the entry's own secrets only interpolate as the entry is applied, so the admin-supplied env snapshot must carry the interpolated value rather than the literal template
      fs.readLocalFile.mockResolvedValue(JSON.stringify({}));

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: {
          force: { env: { NPM_TOKEN: '{{ secrets.TOKEN }}' } },
          secrets: { TOKEN: 'real-value' },
        },
      });

      expect(res).toBeDefined();
      expect(getUserEnv()).toEqual({ NPM_TOKEN: 'real-value' });
      expect(logger.logger.warn).not.toHaveBeenCalledWith(
        expect.anything(),
        "Ignoring env variables not permitted by this Renovate instance's `allowedEnv`",
      );
    });

    it('skips re-validating a resolved config that resolution left unchanged', async () => {
      // with no presets to resolve and nothing to decrypt, both the `repositories[]` entry and the repo file were already validated (at startup and by `migrateAndValidate` respectively), so no resolved-config validation walk should run
      const validateConfigSpy = vi.spyOn(configValidation, 'validateConfig');
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ labels: ['from-repo'] }),
      );

      const res = await mergeRenovateConfig({
        ...config,
        repositoryEntryConfig: { labels: ['from-entry'] },
      });

      expect(res).toBeDefined();
      expect(validateConfigSpy).not.toHaveBeenCalled();
    });
  });

  describe('applyHostRules', () => {
    it('does nothing when hostRules is not configured', () => {
      const addSpy = vi.spyOn(hostRules, 'add');
      const clearQueueSpy = vi.spyOn(queue, 'clear');
      const clearThrottleSpy = vi.spyOn(throttle, 'clear');

      applyHostRules({});

      expect(addSpy).not.toHaveBeenCalled();
      expect(clearQueueSpy).not.toHaveBeenCalled();
      expect(clearThrottleSpy).not.toHaveBeenCalled();
    });

    it('adds hostRules and clears queue and throttle', () => {
      const addSpy = vi
        .spyOn(hostRules, 'add')
        .mockImplementation(() => undefined);
      const clearQueueSpy = vi.spyOn(queue, 'clear');
      const clearThrottleSpy = vi.spyOn(throttle, 'clear');
      const config = {
        hostRules: [{ matchHost: 'registry.npmjs.org' }],
      };

      applyHostRules(config);

      expect(addSpy).toHaveBeenCalledExactlyOnceWith(
        { matchHost: 'registry.npmjs.org' },
        undefined,
      );
      expect(clearQueueSpy).toHaveBeenCalledOnce();
      expect(clearThrottleSpy).toHaveBeenCalledOnce();
      expect(config.hostRules).toBeUndefined();
    });

    it('filters headers against allowedHeaders when adding', () => {
      // the filtering lives within `hostRules.add` itself, so no registration path can bypass it
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      const config = {
        hostRules: [
          {
            matchHost: 'registry.example.com',
            headers: { 'X-Allowed': 'yes', Authorization: 'Bearer secret' },
          },
        ],
      };

      applyHostRules(config);

      expect(hostRules.find({ url: 'https://registry.example.com' })).toEqual({
        headers: { 'X-Allowed': 'yes' },
      });
      expect(logger.logger.warn).toHaveBeenCalledWith(
        { denied: ['Authorization'] },
        "Ignoring hostRules headers not permitted by this Renovate instance's `allowedHeaders`",
      );
    });

    it('merges with an already-registered admin hostRule instead of replacing its headers', () => {
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      // simulates the self-hosted admin's own `hostRules`, registered earlier via `globalInitialize` - `hostRules.add` filters them against `allowedHeaders` itself, and registers them as `trusted`
      hostRules.add(
        {
          matchHost: 'registry.example.com',
          headers: { 'X-From-Admin': 'yes', Authorization: 'from-admin' },
        },
        { trusted: true },
      );

      applyHostRules({
        hostRules: [
          {
            matchHost: 'registry.example.com',
            headers: { 'X-From-Repo': 'yes' },
          },
        ],
      });

      expect(hostRules.find({ url: 'https://registry.example.com' })).toEqual({
        headers: { 'X-From-Admin': 'yes', 'X-From-Repo': 'yes' },
      });
    });

    it('does not let a repo hostRule mask an admin hostRule with a narrower match', () => {
      GlobalConfig.set({ allowedHeaders: ['X-*'] });
      hostRules.add(
        {
          matchHost: 'example.com',
          headers: { 'X-Api-Key': 'from-admin' },
        },
        { trusted: true },
      );

      applyHostRules({
        hostRules: [
          {
            matchHost: 'https://registry.example.com/some/path',
            headers: { 'X-Api-Key': 'from-repo' },
          },
        ],
      });

      expect(
        hostRules.find({
          url: 'https://registry.example.com/some/path/resource',
        }),
      ).toEqual({
        headers: { 'X-Api-Key': 'from-admin' },
      });
    });

    it('warns on invalid hostRule and continues applying others', () => {
      const addSpy = vi
        .spyOn(hostRules, 'add')
        .mockImplementationOnce(() => {
          throw new Error('invalid host rule');
        })
        .mockImplementation(() => undefined);
      const clearQueueSpy = vi.spyOn(queue, 'clear');
      const clearThrottleSpy = vi.spyOn(throttle, 'clear');
      const config = {
        hostRules: [{ matchHost: 'one.example' }, { matchHost: 'two.example' }],
      };

      applyHostRules(config);

      expect(addSpy).toHaveBeenCalledTimes(2);
      expect(logger.logger.warn).toHaveBeenCalledOnce();
      expect(clearQueueSpy).toHaveBeenCalledOnce();
      expect(clearThrottleSpy).toHaveBeenCalledOnce();
      expect(config.hostRules).toBeUndefined();
    });
  });

  describe('static repository config', () => {
    const repoStaticConfigFileKey = 'RENOVATE_X_STATIC_REPO_CONFIG_FILE';

    beforeEach(() => {
      migrate.migrateConfig.mockImplementation((c) => ({
        isMigrated: true,
        migratedConfig: c,
      }));
      migrateAndValidate.migrateAndValidate.mockImplementationOnce((_, c) => {
        return Promise.resolve({
          ...c,
          warnings: [],
          errors: [],
        });
      });
    });

    describe('resolveStaticRepoConfig()', () => {
      interface MergeRepoEnvTestCase {
        name: string;
        currentConfig: AllConfig;
        staticConfig: AllConfig | undefined;
        want: AllConfig;
      }

      const testCases: MergeRepoEnvTestCase[] = [
        {
          name: 'it does nothing',
          staticConfig: undefined,
          currentConfig: { repositories: ['some/repo'] },
          want: { repositories: ['some/repo'] },
        },
        {
          name: 'it merges static config with the current config',
          staticConfig: { dependencyDashboard: true },
          currentConfig: { repositories: ['some/repo'] },
          want: {
            dependencyDashboard: true,
            repositories: ['some/repo'],
          },
        },
      ];

      it.each(testCases)(
        '$name',
        async ({ currentConfig, staticConfig, want }: MergeRepoEnvTestCase) => {
          const [exitMock] = mockProcessExitOnce();
          let configFileName: string | undefined;

          if (!isNullOrUndefined(staticConfig)) {
            configFileName = 'static_config.json5';
            fs.readSystemFile.mockResolvedValueOnce(
              JSON.stringify(staticConfig),
            );
          }

          const got = await resolveStaticRepoConfig(
            currentConfig,
            configFileName,
          );

          expect(got).toEqual(want);
          expect(exitMock).not.toHaveBeenCalled();
        },
      );

      describe('resolveStaticRepoConfig termination cases', () => {
        it.each([
          {
            name: 'should terminate when static config is missing',
            setup: () => fs.readSystemFile.mockRejectedValueOnce('missing'),
          },
          {
            name: 'should terminate when static config is invalid JSON',
            setup: () => fs.readSystemFile.mockResolvedValue('invalid json'),
          },
        ])('$name', async ({ setup }) => {
          const [exitMock, error] = mockProcessExitOnce();
          setup();

          await expect(
            resolveStaticRepoConfig({}, 'static_config.json'),
          ).rejects.toThrow(error);

          expect(exitMock).toHaveBeenCalledExactlyOnceWith(1);
        });

        it('should log static config validation errors and warnings', async () => {
          const invalidConfig = { foo: 'bar' };

          fs.readSystemFile.mockResolvedValue(JSON.stringify(invalidConfig));

          const resolved = await resolveStaticRepoConfig(
            {},
            'static_config.json',
          );

          expect(resolved).toStrictEqual(invalidConfig);

          expect(logger.logger.info).toHaveBeenCalledWith(
            {
              errors: [
                {
                  message: 'Invalid configuration option: foo',
                  topic: 'Configuration Error',
                },
              ],
              warnings: [],
            },
            'Static repo config validation issues detected',
          );
        });
      });
    });

    describe('mergeRenovateConfig() with a static repository config', () => {
      beforeEach(() => {
        scm.getFileList.mockResolvedValueOnce(['renovate.json']);
      });

      interface MergeRepoFileAndEnvConfigTestCase {
        name: string;
        currentConfig: AllConfig;
        repoFileConfig: AllConfig;
        staticConfig: AllConfig;
        wantConfig: AllConfig;
      }

      it.each<MergeRepoFileAndEnvConfigTestCase>([
        {
          name: 'it does nothing',
          currentConfig: {},
          repoFileConfig: {},
          staticConfig: {},
          wantConfig: {
            renovateJsonPresent: true,
            warnings: [],
          },
        },
        {
          name: 'it should resolve and use the repo file config when the static config is not set',
          currentConfig: {},
          repoFileConfig: {
            extends: ['group:socketio'],
          },
          staticConfig: {},
          wantConfig: {
            description: ['Group socket.io packages.'],
            packageRules: [
              {
                groupName: 'socket.io packages',
                matchPackageNames: ['socket.io**'],
              },
            ],
            renovateJsonPresent: true,
            warnings: [],
          },
        },
        {
          name: 'it should resolve and use the static config when no repo file present',
          currentConfig: {},
          repoFileConfig: {},
          staticConfig: { extends: ['group:socketio'] },
          wantConfig: {
            description: ['Group socket.io packages.'],
            packageRules: [
              {
                groupName: 'socket.io packages',
                matchPackageNames: ['socket.io**'],
              },
            ],
            renovateJsonPresent: true,
            warnings: [],
          },
        },
        {
          name: 'it should merge both configs and and repo config is higher priority',
          currentConfig: {},
          repoFileConfig: {
            extends: ['group:socketio'],
            packageRules: [
              {
                matchConfidence: ['high', 'very high'],
                groupName: 'high merge confidence',
              },
            ],
          },
          staticConfig: {
            dependencyDashboard: true,
            packageRules: [
              {
                groupName: 'my-custom-socketio-override',
                matchPackageNames: ['socket.io**'],
              },
            ],
          },
          wantConfig: {
            dependencyDashboard: true,
            description: ['Group socket.io packages.'],
            packageRules: [
              {
                groupName: 'socket.io packages',
                matchPackageNames: ['socket.io**'],
              },
              {
                groupName: 'my-custom-socketio-override',
                matchPackageNames: ['socket.io**'],
              },
              {
                groupName: 'high merge confidence',
                matchConfidence: ['high', 'very high'],
              },
            ],
            renovateJsonPresent: true,
            warnings: [],
          },
        },
        {
          name: 'it should merge extends from both a repo config and static repo config by appending it',
          currentConfig: {},
          repoFileConfig: {
            extends: ['group:springAndroid'],
          },
          staticConfig: {
            dependencyDashboard: true,
            extends: ['group:springAmqp'],
            packageRules: [
              {
                groupName: 'some-package-rule',
                matchPackageNames: ['anything**'],
              },
            ],
          },
          wantConfig: {
            dependencyDashboard: true,
            description: [
              'Group Java Spring AMQP packages.',
              'Group Java Spring Android packages.',
            ],
            packageRules: [
              {
                groupName: 'spring amqp',
                matchPackageNames: ['org.springframework.amqp:**'],
              },
              {
                groupName: 'spring android',
                matchPackageNames: ['org.springframework.android:**'],
              },
              {
                groupName: 'some-package-rule',
                matchPackageNames: ['anything**'],
              },
            ],
            renovateJsonPresent: true,
            warnings: [],
          },
        },
      ])(
        '$name',
        async ({
          staticConfig,
          repoFileConfig,
          currentConfig,
          wantConfig,
        }: MergeRepoFileAndEnvConfigTestCase) => {
          fs.readLocalFile.mockResolvedValueOnce(
            JSON.stringify(repoFileConfig),
          );
          vi.stubEnv(repoStaticConfigFileKey, 'static_config.json');
          fs.readSystemFile.mockResolvedValueOnce(JSON.stringify(staticConfig));

          const got = await mergeRenovateConfig(currentConfig);

          expect(got).toStrictEqual(wantConfig);
        },
      );
    });
  });
});
