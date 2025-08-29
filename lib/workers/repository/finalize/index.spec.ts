import { GlobalConfig } from '../../../config/global';
import { platform } from '../../../modules/platform';
import * as repositoryCache from '../../../util/cache/repository';
import { clearRenovateRefs } from '../../../util/git';
import { PackageFiles } from '../package-files';
import { checkReconfigureBranch } from '../reconfigure';
import { pruneStaleBranches } from './prune';
import {
  runBranchSummary,
  runRenovateRepoStats,
} from './repository-statistics';
import { finalizeRepo } from './index';

vi.mock('../../../util/cache/repository');
vi.mock('../../../modules/platform/github/pr');
vi.mock('../../../util/git');
vi.mock('../package-files');
vi.mock('../reconfigure');
vi.mock('./prune');
vi.mock('./repository-statistics');

describe('workers/repository/finalize/index', () => {
  let config: any;

  const branchList = ['branch-a', 'branch-b'];

  beforeEach(() => {
    GlobalConfig.set({ platform: 'github' });

    config = {
      onboardingPrTitle: 'Configure Renovate',
      onboardingBranch: 'renovate/configure',
    };
    vi.mocked(platform.getPrList).mockResolvedValue([]);
    vi.mocked(platform.ensureIssueClosing).mockResolvedValue(undefined);
  });

  it('runs all finalization steps', async () => {
    await finalizeRepo(config, branchList);

    expect(checkReconfigureBranch).toHaveBeenCalledWith(config);
    expect(repositoryCache.saveCache).toHaveBeenCalled();
    expect(repositoryCache.cleanup).toHaveBeenCalled();
    expect(pruneStaleBranches).toHaveBeenCalledWith(config, branchList);
    expect(clearRenovateRefs).toHaveBeenCalled();
    expect(PackageFiles.clear).toHaveBeenCalled();
    expect(platform.ensureIssueClosing).toHaveBeenCalledTimes(2);
    expect(runBranchSummary).toHaveBeenCalledWith(config);
    expect(runRenovateRepoStats).toHaveBeenCalledWith(config, []);
  });

  it('marks repo as activated if a valid merged PR is found', async () => {
    vi.mocked(platform.getPrList).mockResolvedValue([
      {
        state: 'merged',
        title: 'Some feature PR',
        sourceBranch: 'feature/one',
        number: 1,
      },
    ]);

    await finalizeRepo(config, branchList);

    expect(config.repoIsActivated).toBe(true);
  });

  it('does not activate repo for onboarding PR', async () => {
    vi.mocked(platform.getPrList).mockResolvedValue([
      {
        state: 'merged',
        title: 'Configure Renovate',
        sourceBranch: 'renovate/configure',
        number: 1,
      },
    ]);

    await finalizeRepo(config, branchList);

    expect(config.repoIsActivated).toBeUndefined();
  });
});
