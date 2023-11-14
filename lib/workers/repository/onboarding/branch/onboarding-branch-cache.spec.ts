import { git, mocked, partial, scm } from '../../../../../test/util';
import * as _cache from '../../../../util/cache/repository';
import type {
  OnboardingBranchCache,
  RepoCacheData,
} from '../../../../util/cache/repository/types';
import {
  deleteOnboardingCache,
  getOnboardingConfigFromCache,
  getOnboardingFileNameFromCache,
  hasOnboardingBranchChanged,
  isOnboardingBranchConflicted,
  isOnboardingBranchModified,
  setOnboardingCache,
  setOnboardingConfigDetails,
} from './onboarding-branch-cache';

jest.mock('../../../../util/cache/repository');
jest.mock('../../../../util/git');
const cache = mocked(_cache);

describe('workers/repository/onboarding/branch/onboarding-branch-cache', () => {
  describe('setOnboardingCache', () => {
    it('does not create new cache', () => {
      const dummyCache = {} satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      setOnboardingCache('default-sha', null as never, false, false);
      expect(dummyCache).toEqual({});
    });

    it('sets new cache', () => {
      const dummyCache = {} satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      setOnboardingCache('default-sha', 'onboarding-sha', false, false);
      expect(dummyCache).toEqual({
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: false,
          isModified: false,
        },
      });
    });

    it('updates old cache', () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: false,
          isModified: false,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      setOnboardingCache('default-sha-1', 'onboarding-sha-1', false, true);
      expect(dummyCache).toEqual({
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha-1',
          onboardingBranchSha: 'onboarding-sha-1',
          isConflicted: false,
          isModified: true,
        },
      });
    });
  });

  describe('deleteOnboardingCache', () => {
    it('deletes cache', () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: false,
          isModified: false,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValue(dummyCache);
      deleteOnboardingCache();
      expect(dummyCache.onboardingBranchCache).toBeUndefined();
    });
  });

  describe('hasOnboardingBranchChanged()', () => {
    it('return true if cache is absent', () => {
      cache.getCache.mockReturnValueOnce({});
      git.getBranchCommit.mockReturnValueOnce('onboarding-sha');
      expect(hasOnboardingBranchChanged('configure/renovate')).toBeTrue();
    });

    it('returns true', () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'old-onboarding-sha',
          isConflicted: false,
          isModified: false,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      git.getBranchCommit.mockReturnValueOnce('new-onboarding-sha');
      expect(hasOnboardingBranchChanged('configure/renovate')).toBeTrue();
    });

    it('returns false', () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: false,
          isModified: false,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      git.getBranchCommit.mockReturnValueOnce('onboarding-sha');
      expect(hasOnboardingBranchChanged('configure/renovate')).toBeFalse();
    });

    it('returns false when branch is modified but has not changed since last run', () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: false,
          isModified: true,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      git.getBranchCommit.mockReturnValueOnce('onboarding-sha');
      expect(hasOnboardingBranchChanged('configure/renovate')).toBeFalse();
    });
  });

  describe('isOnboardingBranchModified()', () => {
    it('falls back to git if cache is absent', async () => {
      cache.getCache.mockReturnValueOnce({});
      git.getBranchCommit.mockReturnValueOnce('onboarding-sha');
      scm.isBranchModified.mockResolvedValueOnce(false);
      expect(
        await isOnboardingBranchModified('configure/renovate'),
      ).toBeFalse();
    });

    it('falls back to git if onboarding branch is updated', async () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'old-onboarding-sha',
          isConflicted: false,
          isModified: false,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      git.getBranchCommit.mockReturnValueOnce('new-onboarding-sha');
      scm.isBranchModified.mockResolvedValueOnce(true);
      expect(await isOnboardingBranchModified('configure/renovate')).toBeTrue();
    });

    it('returns cached value', async () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: true,
          isModified: true,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      git.getBranchCommit.mockReturnValueOnce('onboarding-sha');
      expect(await isOnboardingBranchModified('configure/renovate')).toBeTrue();
    });
  });

  describe('isOnboardingBranchConflicted()', () => {
    it('falls back to git if cache is absent', async () => {
      cache.getCache.mockReturnValueOnce({});
      git.getBranchCommit
        .mockReturnValueOnce('onboarding-sha')
        .mockReturnValueOnce('default-sha');
      scm.isBranchConflicted.mockResolvedValueOnce(false);
      expect(
        await isOnboardingBranchConflicted('master', 'configure/renovate'),
      ).toBeFalse();
    });

    it('falls back to git if default branch is updated', async () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'old-default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: false,
          isModified: false,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      git.getBranchCommit
        .mockReturnValueOnce('onboarding-sha')
        .mockReturnValueOnce('new-default-sha');
      scm.isBranchConflicted.mockResolvedValueOnce(false);
      expect(
        await isOnboardingBranchConflicted('master', 'configure/renovate'),
      ).toBeFalse();
    });

    it('falls back to git if onboarding branch is modified', async () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'old-onboarding-sha',
          isConflicted: false,
          isModified: false,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      git.getBranchCommit
        .mockReturnValueOnce('new-onboarding-sha')
        .mockReturnValueOnce('default-sha');
      scm.isBranchConflicted.mockResolvedValueOnce(false);
      expect(
        await isOnboardingBranchConflicted('master', 'configure/renovate'),
      ).toBeFalse();
    });

    it('returns cached value', async () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: true,
          isModified: true,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      git.getBranchCommit
        .mockReturnValueOnce('onboarding-sha')
        .mockReturnValueOnce('default-sha');
      expect(
        await isOnboardingBranchConflicted('master', 'configure/renovate'),
      ).toBeTrue();
    });
  });

  describe('getOnboardingFileNameFromCache()', () => {
    it('returns cached value', () => {
      const dummyCache = {
        onboardingBranchCache: partial<OnboardingBranchCache>({
          configFileName: 'renovate.json',
        }),
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      expect(getOnboardingFileNameFromCache()).toBe('renovate.json');
    });

    it('returns undefined', () => {
      cache.getCache.mockReturnValueOnce({});
      expect(getOnboardingFileNameFromCache()).toBeUndefined();
    });
  });

  describe('getOnboardingConfigFromCache()', () => {
    it('returns cached value', () => {
      const dummyCache = {
        onboardingBranchCache: partial<OnboardingBranchCache>({
          configFileParsed: 'parsed',
        }),
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      expect(getOnboardingConfigFromCache()).toBe('parsed');
    });

    it('returns undefined', () => {
      cache.getCache.mockReturnValueOnce({});
      expect(getOnboardingConfigFromCache()).toBeUndefined();
    });
  });

  describe('setOnboardingConfigDetails()', () => {
    it('returns cached value', () => {
      const dummyCache = {
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: true,
          isModified: true,
        },
      } satisfies RepoCacheData;
      cache.getCache.mockReturnValueOnce(dummyCache);
      setOnboardingConfigDetails('renovate.json', 'parsed');
      expect(dummyCache).toEqual({
        onboardingBranchCache: {
          defaultBranchSha: 'default-sha',
          onboardingBranchSha: 'onboarding-sha',
          isConflicted: true,
          isModified: true,
          configFileName: 'renovate.json',
          configFileParsed: 'parsed',
        },
      });
    });
  });
});
