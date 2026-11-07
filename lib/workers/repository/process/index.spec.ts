import type { RenovateConfig } from '~test/util.ts';
import { git, logger, partial, platform, scm } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import {
  CONFIG_VALIDATION,
  PLATFORM_BAD_CREDENTIALS,
  PLATFORM_RATE_LIMIT_EXCEEDED,
  REPOSITORY_CHANGED,
} from '../../../constants/error-messages.ts';
import { addMeta } from '../../../logger/index.ts';
import type { PackageFile } from '../../../modules/manager/types.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import { applyRepoConfigDefaults } from '../init/defaults.ts';
import * as _extractUpdate from './extract-update.ts';
import { lookup } from './extract-update.ts';
import {
  extractDependencies,
  getBaseBranchConfig,
  updateRepo,
} from './index.ts';

vi.mock('./extract-update.ts');

const extract = vi.mocked(_extractUpdate).extract;

const notFoundError = Object.assign(new Error('Not Found'), {
  response: { statusCode: 404 },
});

let config: RenovateConfig;

beforeEach(() => {
  config = applyRepoConfigDefaults(getConfig());
});

describe('workers/repository/process/index', () => {
  describe('processRepo()', () => {
    it('processes single branches', async () => {
      const res = await extractDependencies(config);
      expect(res).toBeUndefined();
    });

    it('processes baseBranchPatterns', async () => {
      extract.mockResolvedValue(partial<Record<string, PackageFile[]>>());
      config.baseBranchPatterns = ['branch1', 'branch2'];
      scm.branchExists.mockResolvedValueOnce(false);
      scm.branchExists.mockResolvedValueOnce(true);
      scm.branchExists.mockResolvedValueOnce(false);
      scm.branchExists.mockResolvedValueOnce(true);
      const res = await extractDependencies(config);
      await updateRepo(config, res.branches);
      expect(res).toEqual({
        branchList: [undefined],
        branches: [undefined],
        packageFiles: undefined,
      });
    });

    it('keeps the first base branch package files and tolerates no fork sync', async () => {
      const { syncForkWithUpstream } = scm;
      Object.defineProperty(scm, 'syncForkWithUpstream', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      extract.mockResolvedValue(partial<Record<string, PackageFile[]>>());
      vi.mocked(lookup).mockResolvedValue({
        branches: [],
        branchList: [],
        packageFiles: { npm: [] },
      });
      config.baseBranchPatterns = ['branch1', 'branch2'];
      scm.branchExists.mockResolvedValue(true);

      try {
        const res = await extractDependencies(config);

        expect(res.packageFiles).toEqual({ npm: [] });
        expect(scm.branchExists).toHaveBeenCalled();
      } finally {
        scm.syncForkWithUpstream = syncForkWithUpstream;
      }
    });

    it('reads config from default branch if useBaseBranchConfig=none', async () => {
      scm.branchExists.mockResolvedValue(true);
      config.baseBranchPatterns = ['master', 'dev'];
      config.useBaseBranchConfig = 'none';
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });
      expect(platform.getRawFile).not.toHaveBeenCalledExactlyOnceWith(
        'renovate.json',
        undefined,
        'dev',
      );
    });

    it('applies branch-specific config for non-default branches when useBaseBranchConfig=merge-if-present', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getRawFile.mockResolvedValue('{"labels": ["dev-branch"]}');
      config.baseBranchPatterns = ['main', 'dev'];
      config.defaultBranch = 'main';
      config.labels = ['default-branch'];
      config.useBaseBranchConfig = 'merge-if-present';
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });
      expect(platform.getRawFile).not.toHaveBeenCalledWith(
        'renovate.json',
        config.repository,
        'main',
      );
      expect(platform.getRawFile).toHaveBeenCalledWith(
        'renovate.json',
        config.repository,
        'dev',
      );
      expect(extract).toHaveBeenCalledWith(
        expect.objectContaining({
          baseBranch: 'main',
          labels: ['default-branch'],
        }),
        true,
      );
      expect(extract).toHaveBeenCalledWith(
        expect.objectContaining({ baseBranch: 'dev', labels: ['dev-branch'] }),
        true,
      );
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'main' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'dev' });
    });

    it('falls back gracefully when branch-specific config not found (useBaseBranchConfig=merge-if-present)', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getRawFile.mockRejectedValue(notFoundError);
      config.baseBranchPatterns = ['main', 'dev'];
      config.defaultBranch = 'main';
      config.useBaseBranchConfig = 'merge-if-present';
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'main' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'dev' });
    });

    it('throws on invalid branch-specific config (useBaseBranchConfig=merge-if-present)', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getRawFile.mockResolvedValue('{"labels": "not-an-array"}');
      config.baseBranchPatterns = ['main', 'dev'];
      config.defaultBranch = 'main';
      config.useBaseBranchConfig = 'merge-if-present';
      getCache().configFileName = 'renovate.json';
      await expect(extractDependencies(config)).rejects.toMatchObject({
        message: CONFIG_VALIDATION,
      });
    });

    it('reads config from branches in baseBranchPatterns if useBaseBranchConfig specified', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getRawFile = vi
        .fn()
        .mockResolvedValue('{"extends": [":approveMajorUpdates"]}');
      config.baseBranchPatterns = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });

      expect(platform.getRawFile).toHaveBeenCalledWith(
        'renovate.json',
        undefined,
        'dev',
      );
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'master' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'dev' });
    });

    it('throws if base branch config is invalid', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getRawFile = vi.fn().mockResolvedValue(
        JSON.stringify({
          extends: [':approveMajorUpdates'],
          labels: '123',
          invalidKey: 'invalidValue',
        }),
      );
      config.baseBranchPatterns = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      getCache().configFileName = 'renovate.json';
      await expect(extractDependencies(config)).rejects.toThrowError(
        CONFIG_VALIDATION,
      );
    });

    it('handles config name mismatch between baseBranches if useBaseBranchConfig specified', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getRawFile = vi
        .fn()
        .mockImplementation((fileName, repoName, branchName) => {
          if (branchName === 'dev') {
            throw new Error();
          }
          return '{}';
        });
      getCache().configFileName = 'renovate.json';
      config.baseBranchPatterns = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      await expect(extractDependencies(config)).rejects.toThrow(
        CONFIG_VALIDATION,
      );
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'master' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'dev' });
    });

    it('treats an empty base branch config file as empty config', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getRawFile = vi.fn().mockResolvedValue('');
      getCache().configFileName = 'renovate.json';
      config.baseBranchPatterns = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });
    });

    it('throws CONFIG_VALIDATION with the parse error if base branch config file is invalid JSON', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getRawFile = vi.fn().mockResolvedValue('{"extends": [');
      getCache().configFileName = 'renovate.json';
      config.baseBranchPatterns = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      await expect(extractDependencies(config)).rejects.toMatchObject({
        message: CONFIG_VALIDATION,
        validationSource: 'renovate.json',
        validationError:
          'The renovate configuration file of branch master could not be parsed: Invalid JSON (parsing failed)',
        validationMessage: 'Syntax error: unclosed statement near xtends": [',
      });
    });

    it('throws CONFIG_VALIDATION if base branch config file is not found', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getRawFile = vi.fn().mockResolvedValue(null);
      getCache().configFileName = 'renovate.json';
      config.baseBranchPatterns = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      await expect(extractDependencies(config)).rejects.toThrow(
        CONFIG_VALIDATION,
      );
      expect(logger.logger.error).toHaveBeenCalledWith(
        { configFileName: 'renovate.json', baseBranch: 'master' },
        'Config file not found on base branch - possible config name mismatch between branches?',
      );
    });

    it.each`
      error
      ${new ExternalHostError(new Error('server error'), 'github')}
      ${new Error(PLATFORM_RATE_LIMIT_EXCEEDED)}
      ${new Error(PLATFORM_BAD_CREDENTIALS)}
      ${new Error(REPOSITORY_CHANGED)}
    `(
      'rethrows $error.message when fetching base branch config',
      async ({ error }) => {
        scm.branchExists.mockResolvedValue(true);
        platform.getRawFile = vi.fn().mockRejectedValue(error);
        getCache().configFileName = 'renovate.json';
        config.baseBranchPatterns = ['master', 'dev'];
        config.useBaseBranchConfig = 'merge';
        await expect(extractDependencies(config)).rejects.toBe(error);
      },
    );

    it('processes baseBranchPatterns dryRun extract', async () => {
      extract.mockResolvedValue(partial<Record<string, PackageFile[]>>());
      GlobalConfig.set({ dryRun: 'extract' });
      const res = await extractDependencies(config);
      await updateRepo(config, res.branches);
      expect(res).toEqual({
        branchList: [],
        branches: [],
        packageFiles: {},
      });
      expect(lookup).toHaveBeenCalledTimes(0);
    });

    it('finds baseBranches via regular expressions', async () => {
      extract.mockResolvedValue(partial<Record<string, PackageFile[]>>());
      config.baseBranchPatterns = [
        '/^release\\/.*/i',
        'dev',
        '!/^pre-release\\/.*/',
      ];
      git.getBranchList.mockReturnValue([
        'dev',
        'pre-release/v0',
        'RELEASE/v0',
        'release/v1',
        'release/v2',
        'some-other',
      ]);
      scm.branchExists.mockResolvedValue(true);
      const res = await extractDependencies(config);
      expect(res).toStrictEqual({
        branchList: [undefined, undefined, undefined, undefined, undefined],
        branches: [undefined, undefined, undefined, undefined, undefined],
        packageFiles: undefined,
      });

      expect(logger.logger.debug).toHaveBeenCalledWith(
        {
          baseBranches: [
            'RELEASE/v0',
            'release/v1',
            'release/v2',
            'dev',
            'some-other',
          ],
        },
        'baseBranches',
      );

      expect(addMeta).toHaveBeenCalledWith({
        baseBranch: 'RELEASE/v0',
      });
      expect(addMeta).toHaveBeenCalledWith({
        baseBranch: 'release/v1',
      });
      expect(addMeta).toHaveBeenCalledWith({
        baseBranch: 'release/v2',
      });
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'dev' });
      expect(addMeta).toHaveBeenCalledWith({
        baseBranch: 'some-other',
      });
    });

    it('maps $default to defaultBranch', async () => {
      extract.mockResolvedValue(partial<Record<string, PackageFile[]>>());
      config.baseBranchPatterns = ['$default'];
      config.defaultBranch = 'master';
      git.getBranchList.mockReturnValue(['dev', 'master']);
      scm.branchExists.mockResolvedValue(true);
      const res = await extractDependencies(config);
      expect(res).toStrictEqual({
        branchList: [undefined],
        branches: [undefined],
        packageFiles: undefined,
      });

      // one for baseBranches and one for extract
      expect(addMeta).toHaveBeenCalledTimes(2);
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'master' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'master' });
    });
  });

  describe('getBaseBranchConfig', () => {
    it('adds base branch name to branchPrefix if multiple base branches expected - more than one base branch configured', async () => {
      const res = await getBaseBranchConfig('main', {
        ...config,
        baseBranchPatterns: ['main', 'maint/v7'],
      });
      expect(res.baseBranch).toBe('main');
      expect(res.hasBaseBranches).toBeTrue();
      expect(res.branchPrefix).toBe('renovate/main-');
    });

    it('adds base branch name to branchPrefix if multiple base branches expected - base branch regex configured', async () => {
      const res = await getBaseBranchConfig('main', {
        ...config,
        baseBranchPatterns: ['/main/'],
      });
      expect(res.baseBranch).toBe('main');
      expect(res.hasBaseBranches).toBeTrue();
      expect(res.branchPrefix).toBe('renovate/main-');
    });

    it('does not add base branch name to branchPrefix if multiple base branches are not expected - only one base branch configured', async () => {
      const res = await getBaseBranchConfig('main', {
        ...config,
        baseBranchPatterns: ['main'],
      });
      expect(res.baseBranch).toBe('main');
      expect(res.hasBaseBranches).toBeUndefined();
      expect(res.branchPrefix).toBe('renovate/');
    });

    it('does not add base branch name to branchPrefix if multiple base branches are not expected - no baseBranchPatterns', async () => {
      const res = await getBaseBranchConfig('main', {
        ...config,
        baseBranchPatterns: [],
      });
      expect(res.baseBranch).toBe('main');
      expect(res.hasBaseBranches).toBeUndefined();
      expect(res.branchPrefix).toBe('renovate/');
    });

    it('does not attempt branch-specific config fetch when useBaseBranchConfig=none', async () => {
      getCache().configFileName = 'renovate.json';
      const res = await getBaseBranchConfig('feature', {
        ...config,
        defaultBranch: 'main',
        useBaseBranchConfig: 'none',
      });
      expect(res.baseBranch).toBe('feature');
      expect(platform.getRawFile).not.toHaveBeenCalled();
      expect(platform.getJsonFile).not.toHaveBeenCalled();
    });

    it('fetches the base branch config once when useBaseBranchConfig=merge', async () => {
      getCache().configFileName = 'renovate.json';
      platform.getRawFile.mockResolvedValueOnce('{}');
      const res = await getBaseBranchConfig('feature', {
        ...config,
        defaultBranch: 'main',
        useBaseBranchConfig: 'merge',
      });
      expect(res.baseBranch).toBe('feature');
      expect(platform.getJsonFile).not.toHaveBeenCalled();
      expect(platform.getRawFile).toHaveBeenCalledOnce();
    });

    describe('useBaseBranchConfig=merge-if-present', () => {
      beforeEach(() => {
        config.defaultBranch = 'main';
        config.useBaseBranchConfig = 'merge-if-present';
        getCache().configFileName = 'renovate.json';
      });

      it('applies branch-specific config when present on branch', async () => {
        platform.getRawFile.mockResolvedValueOnce('{"labels": ["dev-branch"]}');
        const res = await getBaseBranchConfig('postgresql/v18/dev', config);
        expect(res.baseBranch).toBe('postgresql/v18/dev');
        expect(res.labels).toEqual(['dev-branch']);
        expect(platform.getRawFile).toHaveBeenCalledWith(
          'renovate.json',
          config.repository,
          'postgresql/v18/dev',
        );
      });

      it('falls back to default config when config file is not found (404)', async () => {
        platform.getRawFile.mockRejectedValueOnce(notFoundError);
        const res = await getBaseBranchConfig('postgresql/v18/dev', {
          ...config,
          labels: ['default-branch'],
        });
        expect(res.baseBranch).toBe('postgresql/v18/dev');
        expect(res.labels).toEqual(['default-branch']);
        expect(logger.logger.debug).toHaveBeenCalledWith(
          { baseBranch: 'postgresql/v18/dev', configFileName: 'renovate.json' },
          'No branch-specific config file found, falling back to default branch config',
        );
      });

      it('falls back to default config when the platform returns no config file', async () => {
        platform.getRawFile.mockResolvedValueOnce(null);
        const res = await getBaseBranchConfig('postgresql/v18/dev', {
          ...config,
          labels: ['default-branch'],
        });
        expect(res.baseBranch).toBe('postgresql/v18/dev');
        expect(res.labels).toEqual(['default-branch']);
      });

      it('treats an empty config file as empty config', async () => {
        platform.getRawFile.mockResolvedValueOnce('');
        const res = await getBaseBranchConfig('postgresql/v18/dev', {
          ...config,
          labels: ['default-branch'],
        });
        expect(res.baseBranch).toBe('postgresql/v18/dev');
        expect(res.labels).toEqual(['default-branch']);
      });

      it('throws CONFIG_VALIDATION when fetching the config file fails for a reason other than not found', async () => {
        const error = Object.assign(new Error('Bad Request'), {
          response: { statusCode: 400 },
        });
        platform.getRawFile.mockRejectedValueOnce(error);
        await expect(
          getBaseBranchConfig('postgresql/v18/dev', config),
        ).rejects.toMatchObject({
          message: CONFIG_VALIDATION,
          validationError: 'Error fetching config file',
        });
        expect(logger.logger.error).toHaveBeenCalledWith(
          {
            configFileName: 'renovate.json',
            baseBranch: 'postgresql/v18/dev',
            err: error,
          },
          'Error fetching config file from base branch',
        );
      });

      it.each`
        error
        ${new ExternalHostError(new Error('network error'))}
        ${new Error(PLATFORM_RATE_LIMIT_EXCEEDED)}
      `('rethrows $error.message', async ({ error }) => {
        platform.getRawFile.mockRejectedValueOnce(error);
        await expect(
          getBaseBranchConfig('postgresql/v18/dev', config),
        ).rejects.toBe(error);
      });

      it('throws CONFIG_VALIDATION with the parse error when config file is invalid JSON', async () => {
        platform.getRawFile.mockResolvedValueOnce('{"labels": [');
        await expect(
          getBaseBranchConfig('postgresql/v18/dev', config),
        ).rejects.toMatchObject({
          message: CONFIG_VALIDATION,
          validationSource: 'renovate.json',
          validationError:
            'The renovate configuration file of branch postgresql/v18/dev could not be parsed: Invalid JSON (parsing failed)',
        });
      });

      it('throws when branch config has validation errors', async () => {
        platform.getRawFile.mockResolvedValueOnce('{"labels": "not-an-array"}');
        await expect(
          getBaseBranchConfig('postgresql/v18/dev', config),
        ).rejects.toMatchObject({ message: CONFIG_VALIDATION });
      });

      it('skips when baseBranch equals defaultBranch', async () => {
        const res = await getBaseBranchConfig('main', config);
        expect(res.baseBranch).toBe('main');
        expect(platform.getRawFile).not.toHaveBeenCalled();
      });

      it('skips when configFileName is package.json', async () => {
        getCache().configFileName = 'package.json';
        const res = await getBaseBranchConfig('postgresql/v18/dev', config);
        expect(res.baseBranch).toBe('postgresql/v18/dev');
        expect(platform.getRawFile).not.toHaveBeenCalled();
        expect(logger.logger.debug).toHaveBeenCalledWith(
          { baseBranch: 'postgresql/v18/dev', configFileName: 'package.json' },
          'Cannot read branch-specific config without a dedicated config file, using default branch config',
        );
      });

      it('skips when configFileName is missing from cache', async () => {
        getCache().configFileName = undefined;
        const res = await getBaseBranchConfig('postgresql/v18/dev', config);
        expect(res.baseBranch).toBe('postgresql/v18/dev');
        expect(platform.getRawFile).not.toHaveBeenCalled();
        expect(logger.logger.debug).toHaveBeenCalledWith(
          { baseBranch: 'postgresql/v18/dev', configFileName: undefined },
          'Cannot read branch-specific config without a dedicated config file, using default branch config',
        );
      });
    });
  });
});
