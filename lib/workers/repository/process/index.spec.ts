import {
  RenovateConfig,
  getConfig,
  git,
  mocked,
  platform,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import { addMeta } from '../../../logger';
import { getCache } from '../../../util/cache/repository';
import * as _extractUpdate from './extract-update';
import { lookup } from './extract-update';
import { extractDependencies, updateRepo } from '.';

jest.mock('../../../util/git');
jest.mock('./extract-update');

const extract = mocked(_extractUpdate).extract;

let config: RenovateConfig;

beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe('workers/repository/process/index', () => {
  describe('processRepo()', () => {
    it('processes single branches', async () => {
      const res = await extractDependencies(config);
      expect(res).toBeUndefined();
    });

    it('processes baseBranches', async () => {
      extract.mockResolvedValue({} as never);
      config.baseBranches = ['branch1', 'branch2'];
      git.branchExists.mockReturnValueOnce(false);
      git.branchExists.mockReturnValueOnce(true);
      git.branchExists.mockReturnValueOnce(false);
      git.branchExists.mockReturnValueOnce(true);
      const res = await extractDependencies(config);
      await updateRepo(config, res.branches);
      expect(res).toEqual({
        branchList: [undefined],
        branches: [undefined],
        packageFiles: undefined,
      });
    });

    it('reads config from default branch if useBaseBranchConfig not specified', async () => {
      git.branchExists.mockReturnValue(true);
      platform.getJsonFile.mockResolvedValueOnce({});
      config.baseBranches = ['master', 'dev'];
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
        'dev'
      );
    });

    it('reads config from branches in baseBranches if useBaseBranchConfig specified', async () => {
      git.branchExists.mockReturnValue(true);
      platform.getJsonFile = jest.fn().mockResolvedValue({});
      config.baseBranches = ['master', 'dev'];
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
        'dev'
      );
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'master' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'dev' });
    });

    it('handles config name mismatch between baseBranches if useBaseBranchConfig specified', async () => {
      git.branchExists.mockReturnValue(true);
      platform.getJsonFile = jest
        .fn()
        .mockImplementation((fileName, repoName, branchName) => {
          if (branchName === 'dev') {
            throw new Error();
          }
          return {};
        });
      getCache().configFileName = 'renovate.json';
      config.baseBranches = ['master', 'dev'];
      config.useBaseBranchConfig = 'merge';
      await expect(extractDependencies(config)).rejects.toThrow(
        CONFIG_VALIDATION
      );
      expect(addMeta).toHaveBeenNthCalledWith(1, { baseBranch: 'master' });
      expect(addMeta).toHaveBeenNthCalledWith(2, { baseBranch: 'dev' });
    });

    it('processes baseBranches dryRun extract', async () => {
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
  });
});
