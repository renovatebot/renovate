import { RenovateConfig, git, mocked } from '../../../../../test/util';
import { logger } from '../../../../logger';
import * as _cache from '../../../../util/cache/repository';
import { isOnboarded } from './check';

jest.mock('../../../../util/cache/repository');

const cache = mocked(_cache);

describe('workers/repository/onboarding/branch/check', () => {
  let config: RenovateConfig;

  it('skips normal onboarding check if onboardingCache is valid', async () => {
    cache.getCache.mockReturnValueOnce({
      onboardingBranchCache: {
        branchName: 'configure/renovate',
        defaultBranchSha: 'default-sha',
        onboardingBranchSha: 'onboarding-sha',
      },
    });
    git.getBranchCommit
      .mockReturnValueOnce('default-sha')
      .mockReturnValueOnce('onboarding-sha');
    const res = await isOnboarded(config);
    expect(res).toBeFalse();
    expect(logger.debug).toHaveBeenCalledWith(
      'Onboarding cache is valid. Repo is not onboarded'
    );
  });

  it('continues with normal logic if onboardingCache is invalid', async () => {
    cache.getCache.mockReturnValueOnce({
      onboardingBranchCache: {
        branchName: 'configure/renovate',
        defaultBranchSha: 'default-sha',
        onboardingBranchSha: 'onboarding-sha',
      },
    });
    git.getBranchCommit
      .mockReturnValueOnce('default-sha-1')
      .mockReturnValueOnce('onboarding-sha');
    await isOnboarded(config);
    expect(logger.debug).not.toHaveBeenCalledWith(
      'Onboarding cache is valid. Repo is not onboarded'
    );
  });
});
