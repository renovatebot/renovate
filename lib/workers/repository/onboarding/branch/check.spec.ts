import {
  RenovateConfig,
  git,
  mocked,
  partial,
  platform,
  scm,
} from '../../../../../test/util';
import { REPOSITORY_CLOSED_ONBOARDING } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform/types';
import * as _cache from '../../../../util/cache/repository';
import { isOnboarded } from './check';

jest.mock('../../../../util/cache/repository');
jest.mock('../../../../util/git');

const cache = mocked(_cache);

describe('workers/repository/onboarding/branch/check', () => {
  const config = partial<RenovateConfig>({
    requireConfig: 'required',
    suppressNotifications: [],
    onboarding: true,
  });

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
      'Onboarding cache is valid. Repo is not onboarded',
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
    scm.getFileList.mockResolvedValue([]);
    await isOnboarded(config);
    expect(logger.debug).not.toHaveBeenCalledWith(
      'Onboarding cache is valid. Repo is not onboarded',
    );
  });

  it('continues with normal logic if closedPr exists', async () => {
    cache.getCache.mockReturnValue({});
    platform.findPr.mockResolvedValue(partial<Pr>());
    scm.getFileList.mockResolvedValue([]);
    await expect(isOnboarded(config)).rejects.toThrow(
      REPOSITORY_CLOSED_ONBOARDING,
    );
  });
});
