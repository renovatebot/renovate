import type { RenovateConfig } from '~test/util.ts';
import { git, logger, platform, scm } from '~test/util.ts';
import { getConfig } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import { CONFIG_VALIDATION } from '../../../constants/error-messages.ts';
import { addMeta } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { getCache } from '../../../util/cache/repository/index.ts';
import * as _extractUpdate from './extract-update.ts';
import { lookup } from './extract-update.ts';
import {
  extractDependencies,
  getBaseBranchConfig,
  updateRepo,
} from './index.ts';

vi.mock('./extract-update.ts');

const extract = vi.mocked(_extractUpdate).extract;

let config: RenovateConfig;

beforeEach(() => {
  config = getConfig();
});

describe('workers/repository/process/index', () => {
  describe('processRepo()', () => {
    it('processes single branches', async () => {
      const res = await extractDependencies(config);
      expect(res).toBeUndefined();
    });

    it('processes baseBranchPatterns', async () => {
      extract.mockResolvedValue({} as never);
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
      expect(platform.getJsonFile).not.toHaveBeenCalledExactlyOnceWith(
        'renovate.json',
        undefined,
        'dev',
      );
    });

    it('applies branch-specific config for non-default branches when useBaseBranchConfig=fallback', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile.mockResolvedValue({
        extends: ['config:recommended'],
      });
      config.baseBranchPatterns = ['main', 'dev'];
      config.defaultBranch = 'main';
      config.useBaseBranchConfig = 'fallback';
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });
      expect(platform.getJsonFile).not.toHaveBeenCalledWith(
        'renovate.json',
        config.repository,
        'main',
      );
      expect(platform.getJsonFile).toHaveBeenCalledWith(
        'renovate.json',
        config.repository,
        'dev',
      );
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'main' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'dev' });
    });

    it('falls back gracefully when branch-specific config not found (useBaseBranchConfig=fallback)', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile.mockResolvedValue(null);
      config.baseBranchPatterns = ['main', 'dev'];
      config.defaultBranch = 'main';
      config.useBaseBranchConfig = 'fallback';
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

    it('throws on invalid branch-specific config (useBaseBranchConfig=fallback)', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile.mockResolvedValue({ labels: 'not-an-array' });
      config.baseBranchPatterns = ['main', 'dev'];
      config.defaultBranch = 'main';
      config.useBaseBranchConfig = 'fallback';
      getCache().configFileName = 'renovate.json';
      await expect(extractDependencies(config)).rejects.toMatchObject({
        message: CONFIG_VALIDATION,
      });
    });

    it('reads config from branches in baseBranchPatterns if useBaseBranchConfig specified', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile = vi
        .fn()
        .mockResolvedValue({ extends: [':approveMajorUpdates'] });
      config.baseBranchPatterns = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });

      expect(platform.getJsonFile).toHaveBeenCalledWith(
        'renovate.json',
        undefined,
        'dev',
      );
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'master' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'dev' });
    });

    it('throws if base branch config is invalid', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile = vi.fn().mockResolvedValue({
        extends: [':approveMajorUpdates'],
        labels: '123',
        invalidKey: 'invalidValue',
      });
      config.baseBranchPatterns = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      getCache().configFileName = 'renovate.json';
      await expect(extractDependencies(config)).rejects.toThrowError(
        CONFIG_VALIDATION,
      );
    });

    it('handles config name mismatch between baseBranches if useBaseBranchConfig specified', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile = vi
        .fn()
        .mockImplementation((fileName, repoName, branchName) => {
          if (branchName === 'dev') {
            throw new Error();
          }
          return {};
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

    it('processes baseBranchPatterns dryRun extract', async () => {
      extract.mockResolvedValue({} as never);
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
      extract.mockResolvedValue({} as never);
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
      extract.mockResolvedValue({} as never);
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

    it('does not add base branch name to branchPrefix if multiple base branches are not expected - baseBranchPatterns undefined', async () => {
      const res = await getBaseBranchConfig('main', {
        ...config,
        baseBranchPatterns: undefined,
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

    it('does not attempt branch-specific config fetch when useBaseBranchConfig=merge', async () => {
      getCache().configFileName = 'renovate.json';
      platform.getJsonFile.mockResolvedValueOnce({});
      const res = await getBaseBranchConfig('feature', {
        ...config,
        defaultBranch: 'main',
        useBaseBranchConfig: 'merge',
      });
      expect(res.baseBranch).toBe('feature');
      expect(platform.getRawFile).not.toHaveBeenCalled();
      expect(platform.getJsonFile).toHaveBeenCalledOnce();
    });

    describe('useBaseBranchConfig=fallback', () => {
      beforeEach(() => {
        config.defaultBranch = 'main';
        config.useBaseBranchConfig = 'fallback';
        getCache().configFileName = 'renovate.json';
      });

      it('applies branch-specific config when present on branch', async () => {
        platform.getJsonFile.mockResolvedValueOnce({
          extends: ['config:recommended'],
        });
        const res = await getBaseBranchConfig('postgresql/v18/dev', config);
        expect(res.baseBranch).toBe('postgresql/v18/dev');
        expect(platform.getJsonFile).toHaveBeenCalledWith(
          'renovate.json',
          config.repository,
          'postgresql/v18/dev',
        );
        expect(logger.logger.debug).toHaveBeenCalledWith(
          { baseBranch: 'postgresql/v18/dev' },
          'Applied branch-specific renovate config',
        );
      });

      it('falls back to default config when getJsonFile returns null', async () => {
        platform.getJsonFile.mockResolvedValueOnce(null);
        const res = await getBaseBranchConfig('postgresql/v18/dev', config);
        expect(res.baseBranch).toBe('postgresql/v18/dev');
        expect(logger.logger.debug).not.toHaveBeenCalledWith(
          expect.anything(),
          'Applied branch-specific renovate config',
        );
      });

      it('throws CONFIG_VALIDATION when getJsonFile throws', async () => {
        platform.getJsonFile.mockRejectedValueOnce(new Error('fetch error'));
        await expect(
          getBaseBranchConfig('postgresql/v18/dev', config),
        ).rejects.toMatchObject({ message: CONFIG_VALIDATION });
      });

      it('rethrows ExternalHostError', async () => {
        platform.getJsonFile.mockRejectedValueOnce(
          new ExternalHostError(new Error('network error')),
        );
        await expect(
          getBaseBranchConfig('postgresql/v18/dev', config),
        ).rejects.toThrow(ExternalHostError);
      });

      it('throws when branch config has validation errors', async () => {
        platform.getJsonFile.mockResolvedValueOnce({ labels: 'not-an-array' });
        await expect(
          getBaseBranchConfig('postgresql/v18/dev', config),
        ).rejects.toMatchObject({ message: CONFIG_VALIDATION });
      });

      it('skips when baseBranch equals defaultBranch', async () => {
        const res = await getBaseBranchConfig('main', config);
        expect(res.baseBranch).toBe('main');
        expect(platform.getJsonFile).not.toHaveBeenCalled();
      });

      it('skips when configFileName is package.json', async () => {
        getCache().configFileName = 'package.json';
        const res = await getBaseBranchConfig('postgresql/v18/dev', config);
        expect(res.baseBranch).toBe('postgresql/v18/dev');
        expect(platform.getJsonFile).not.toHaveBeenCalled();
      });

      it('skips when configFileName is missing from cache', async () => {
        getCache().configFileName = undefined;
        const res = await getBaseBranchConfig('postgresql/v18/dev', config);
        expect(res.baseBranch).toBe('postgresql/v18/dev');
        expect(platform.getJsonFile).not.toHaveBeenCalled();
      });
    });
  });
});
