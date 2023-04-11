import { RenovateConfig, git, mocked, partial } from '../../../../../test/util';
import { logger } from '../../../../logger';
import * as _cache from '../../../../util/cache/repository';
import { isOnboarded } from './check';

jest.mock('../../../../util/cache/repository');
jest.mock('../../../../util/git');

const cache = mocked(_cache);

describe('workers/repository/onboarding/branch/check', () => {
  const config = partial<RenovateConfig>({ requireConfig: 'required' });

  it('skips normal onboarding check if onboardingCache is valid', async () => {
    cache.getCache.mockReturnValueOnce({
      onboardingBranchCache: {
        defaultBranchSha: 'default-sha',
        onboardingBranchSha: 'onboarding-sha',
        isConflicted: false,
        isModified: false,
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
        defaultBranchSha: 'default-sha',
        onboardingBranchSha: 'onboarding-sha',
        isConflicted: false,
        isModified: false,
      },
    });
    git.getBranchCommit
      .mockReturnValueOnce('default-sha-1')
      .mockReturnValueOnce('onboarding-sha');
    git.getFileList.mockResolvedValue([]);
    await isOnboarded(config);
    expect(logger.debug).not.toHaveBeenCalledWith(
      'Onboarding cache is valid. Repo is not onboarded'
    );
  });
});
