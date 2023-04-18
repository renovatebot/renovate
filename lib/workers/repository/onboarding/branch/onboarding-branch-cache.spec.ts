import { mocked } from '../../../../../test/util';
import * as _cache from '../../../../util/cache/repository';
import type { RepoCacheData } from '../../../../util/cache/repository/types';
import {
  deleteOnboardingCache,
  setOnboardingCache,
} from './onboarding-branch-cache';

jest.mock('../../../../util/cache/repository');
const cache = mocked(_cache);

describe('workers/repository/onboarding/branch/onboarding-branch-cache', () => {
  it('sets new cache', () => {
    const dummyCache = {} satisfies RepoCacheData;
    cache.getCache.mockReturnValueOnce(dummyCache);
    setOnboardingCache('configure/renovate', 'default-sha', 'onboarding-sha');
    expect(dummyCache).toEqual({
      onboardingBranchCache: {
        onboardingBranch: 'configure/renovate',
        defaultBranchSha: 'default-sha',
        onboardingBranchSha: 'onboarding-sha',
      },
    });
  });

  it('updates old cache', () => {
    const dummyCache = {
      onboardingBranchCache: {
        onboardingBranch: 'configure/renovate',
        defaultBranchSha: 'default-sha',
        onboardingBranchSha: 'onboarding-sha',
      },
    } satisfies RepoCacheData;
    cache.getCache.mockReturnValueOnce(dummyCache);
    setOnboardingCache(
      'configure/renovate',
      'default-sha-1',
      'onboarding-sha-1'
    );
    expect(dummyCache).toEqual({
      onboardingBranchCache: {
        onboardingBranch: 'configure/renovate',
        defaultBranchSha: 'default-sha-1',
        onboardingBranchSha: 'onboarding-sha-1',
      },
    });
  });

  it('deletes cache', () => {
    const dummyCache = {
      onboardingBranchCache: {
        onboardingBranch: 'configure/renovate',
        defaultBranchSha: 'default-sha',
        onboardingBranchSha: 'onboarding-sha',
      },
    } satisfies RepoCacheData;
    cache.getCache.mockReturnValueOnce(dummyCache);
    deleteOnboardingCache();
    expect(dummyCache.onboardingBranchCache).toBeUndefined();
  });
});
