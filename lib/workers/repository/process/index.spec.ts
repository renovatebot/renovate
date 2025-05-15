import { getConfig } from '../../../config/defaults';
import { GlobalConfig } from '../../../config/global';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { addMeta } from '../../../logger';
import { getCache } from '../../../util/cache/repository';
import * as _extractUpdate from './extract-update';
import { lookup } from './extract-update';
import { extractDependencies, updateRepo } from '.';
import { git, logger, platform, scm } from '~test/util';
import type { RenovateConfig } from '~test/util';

vi.mock('./extract-update');

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

    it('reads config from default branch if useBaseBranchConfig not specified', async () => {
      scm.branchExists.mockResolvedValue(true);
      platform.getJsonFile.mockResolvedValueOnce({});
      config.baseBranchPatterns = ['master', 'dev'];
      config.useBaseBranchConfig = 'none';
      getCache().configFileName = 'renovate.json';
      const res = await extractDependencies(config);
      expect(res).toEqual({
        branchList: [undefined, undefined],
        branches: [undefined, undefined],
        packageFiles: undefined,
      });
      expect(platform.getJsonFile).not.toHaveBeenCalledWith(
        'renovate.json',
        undefined,
        'dev',
      );
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
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'RELEASE/v0' });
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'release/v1' });
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'release/v2' });
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'dev' });
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'some-other' });
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
      expect(addMeta).toHaveBeenCalledWith({ baseBranch: 'master' });
    });
  });
});
