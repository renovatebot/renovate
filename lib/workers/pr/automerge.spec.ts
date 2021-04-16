import { getConfig, getName, git, mocked, partial } from '../../../test/util';
import { Pr, platform as _platform } from '../../platform';
import { BranchStatus } from '../../types';
import { BranchConfig } from '../types';
import * as prAutomerge from './automerge';

jest.mock('../../util/git');

const platform = mocked(_platform);
const defaultConfig = getConfig();

describe(getName(__filename), () => {
  describe('checkAutoMerge(pr, config)', () => {
    let config: BranchConfig;
    let pr: Pr;
    beforeEach(() => {
      config = partial<BranchConfig>({
        ...defaultConfig,
      });
      pr = partial<Pr>({
        canMerge: true,
      });
    });
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should automerge if enabled and pr is mergeable', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      platform.mergePr.mockResolvedValueOnce(true);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toMatchSnapshot();
      expect(platform.mergePr).toHaveBeenCalledTimes(1);
    });
    it('should indicate if automerge failed', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      platform.mergePr.mockResolvedValueOnce(false);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toMatchSnapshot();
      expect(platform.mergePr).toHaveBeenCalledTimes(1);
    });
    it('should automerge comment', async () => {
      config.automerge = true;
      config.automergeType = 'pr-comment';
      config.automergeComment = '!merge';
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      platform.ensureComment.mockResolvedValueOnce(true);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toMatchSnapshot();
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(0);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });
    it('should remove previous automerge comment when rebasing', async () => {
      config.automerge = true;
      config.automergeType = 'pr-comment';
      config.automergeComment = '!merge';
      config.rebaseRequested = true;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      platform.ensureComment.mockResolvedValueOnce(true);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toMatchSnapshot();
      expect(platform.ensureCommentRemoval).toHaveBeenCalledTimes(1);
      expect(platform.ensureComment).toHaveBeenCalledTimes(1);
    });
    it('should not automerge if enabled and pr is mergeable but cannot rebase', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.green);
      git.isBranchModified.mockResolvedValueOnce(true);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toMatchSnapshot();
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should not automerge if enabled and pr is mergeable but branch status is not success', async () => {
      config.automerge = true;
      platform.getBranchStatus.mockResolvedValueOnce(BranchStatus.yellow);
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toMatchSnapshot();
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should not automerge if enabled and pr is mergeable but unstable', async () => {
      config.automerge = true;
      pr.canMerge = undefined;
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toMatchSnapshot();
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
    it('should not automerge if enabled and pr is unmergeable', async () => {
      config.automerge = true;
      pr.isConflicted = true;
      const res = await prAutomerge.checkAutoMerge(pr, config);
      expect(res).toMatchSnapshot();
      expect(platform.mergePr).toHaveBeenCalledTimes(0);
    });
  });
});
