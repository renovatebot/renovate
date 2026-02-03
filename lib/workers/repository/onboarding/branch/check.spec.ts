import { DateTime } from 'luxon';
import { GlobalConfig } from '../../../../config/global.ts';
import { InheritConfig } from '../../../../config/inherit.ts';
import { REPOSITORY_CLOSED_ONBOARDING } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import type { Pr } from '../../../../modules/platform/types.ts';
import * as _cache from '../../../../util/cache/repository/index.ts';
import type { LongCommitSha } from '../../../../util/git/types.ts';
import { isOnboarded } from './check.ts';
import { git, partial, platform, scm } from '~test/util.ts';
import type { RenovateConfig } from '~test/util.ts';

vi.mock('../../../../util/cache/repository/index.ts');

const cache = vi.mocked(_cache);

describe('workers/repository/onboarding/branch/check', () => {
  beforeAll(() => {
    GlobalConfig.reset();
  });

  const config = partial<RenovateConfig>({
    requireConfig: 'required',
    suppressNotifications: [],
    onboarding: true,
  });

  const bodyStruct = {
    hash: '6aa71f8cb7b1503b883485c8f5bd564b31923b9c7fa765abe2a7338af40e03b1',
  };

  it('returns true if in silent mode', async () => {
    const res = await isOnboarded({ ...config, mode: 'silent' });
    expect(res).toBeTrue();
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
      .mockReturnValueOnce('default-sha' as LongCommitSha)
      .mockReturnValueOnce('onboarding-sha' as LongCommitSha);
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
    expect(logger.debug).not.toHaveBeenCalledExactlyOnceWith(
      'Onboarding cache is valid. Repo is not onboarded',
    );
  });

  it('continues with normal logic if closedPr exists - adds closing comment', async () => {
    cache.getCache.mockReturnValue({});
    platform.findPr.mockResolvedValue(
      partial<Pr>({
        title: 'Configure Renovate',
        bodyStruct,
      }),
    );
    scm.getFileList.mockResolvedValue([]);
    await expect(isOnboarded(config)).rejects.toThrow(
      REPOSITORY_CLOSED_ONBOARDING,
    );
    expect(platform.ensureComment).toHaveBeenCalledOnce();
  });

  describe('when closedPr exists and onboardingAutoCloseAge is set', () => {
    beforeAll(() => {
      vi.useFakeTimers();
    });

    afterAll(() => {
      vi.useRealTimers();
      InheritConfig.reset();
    });

    it('adds closing comment if exactly at onboardingAutoCloseAge', async () => {
      const now = DateTime.now();
      vi.setSystemTime(now.toMillis());
      // at exactly 1 day ago, this should trigger
      const createdAt = now.minus({ hour: 24 });

      GlobalConfig.set({ onboardingAutoCloseAge: 1 });
      cache.getCache.mockReturnValue({});
      platform.findPr.mockResolvedValue(
        partial<Pr>({
          createdAt: createdAt.toISO(),
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );
      scm.getFileList.mockResolvedValue([]);
      await expect(isOnboarded(config)).rejects.toThrow(
        REPOSITORY_CLOSED_ONBOARDING,
      );
      expect(platform.ensureComment).toHaveBeenCalledOnce();
    });

    it('skips closing comment if onboarding pr is slightly older than onboardingAutoCloseAge', async () => {
      const now = DateTime.now();
      vi.setSystemTime(now.toMillis());
      // we're currently 25 hours ahead of the creation time, which is 1.x days since the PR was created, which means that an `onboardingAutoCloseAge=1` SHOULD NOT trigger, as it's > 1
      const createdAt = now.minus({ hour: 25 });

      GlobalConfig.set({ onboardingAutoCloseAge: 1 });
      cache.getCache.mockReturnValue({});
      platform.findPr.mockResolvedValue(
        partial<Pr>({
          createdAt: createdAt.toISO(),
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );
      scm.getFileList.mockResolvedValue([]);
      await expect(isOnboarded(config)).rejects.toThrow(
        REPOSITORY_CLOSED_ONBOARDING,
      );
      expect(platform.ensureComment).not.toHaveBeenCalled();
    });

    it('skips closing comment if onboarding pr is 1 day older than onboardingAutoCloseAge', async () => {
      const now = DateTime.now();
      vi.setSystemTime(now.toMillis());
      const createdAt = now.minus({ hour: 48 });

      GlobalConfig.set({ onboardingAutoCloseAge: 1 });
      cache.getCache.mockReturnValue({});
      platform.findPr.mockResolvedValue(
        partial<Pr>({
          createdAt: createdAt.toISO(),
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );
      scm.getFileList.mockResolvedValue([]);
      await expect(isOnboarded(config)).rejects.toThrow(
        REPOSITORY_CLOSED_ONBOARDING,
      );
      expect(platform.ensureComment).not.toHaveBeenCalled();
    });

    it('skips closing comment if onboarding pr is significantly older than onboardingAutoCloseAge', async () => {
      GlobalConfig.set({ onboardingAutoCloseAge: 1 });
      cache.getCache.mockReturnValue({});
      platform.findPr.mockResolvedValue(
        partial<Pr>({
          createdAt: '2020-02-29T01:40:21Z',
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );
      scm.getFileList.mockResolvedValue([]);
      await expect(isOnboarded(config)).rejects.toThrow(
        REPOSITORY_CLOSED_ONBOARDING,
      );
      expect(platform.ensureComment).not.toHaveBeenCalled();
    });

    it('prefers inherited onboardingAutoCloseAge over global config', async () => {
      const now = DateTime.now();
      vi.setSystemTime(now.toMillis());
      // PR was created 36 hours ago (1.5 days)
      const createdAt = now.minus({ hour: 36 });

      GlobalConfig.set({ onboardingAutoCloseAge: 2 });
      InheritConfig.set({ onboardingAutoCloseAge: 1 });

      cache.getCache.mockReturnValue({});
      platform.findPr.mockResolvedValue(
        partial<Pr>({
          createdAt: createdAt.toISO(),
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );
      scm.getFileList.mockResolvedValue([]);
      await expect(isOnboarded(config)).rejects.toThrow(
        REPOSITORY_CLOSED_ONBOARDING,
      );
      expect(platform.ensureComment).not.toHaveBeenCalled();
    });

    it('does not allow inherited onboardingAutoCloseAge to be higher than global config', async () => {
      const now = DateTime.now();
      vi.setSystemTime(now.toMillis());
      // PR was created 36 hours ago (1.5 days)
      const createdAt = now.minus({ hour: 36 });

      GlobalConfig.set({ onboardingAutoCloseAge: 1 });
      InheritConfig.set({ onboardingAutoCloseAge: 10 });

      cache.getCache.mockReturnValue({});
      platform.findPr.mockResolvedValue(
        partial<Pr>({
          createdAt: createdAt.toISO(),
          title: 'Configure Renovate',
          bodyStruct,
        }),
      );
      scm.getFileList.mockResolvedValue([]);
      await expect(isOnboarded(config)).rejects.toThrow(
        REPOSITORY_CLOSED_ONBOARDING,
      );
      expect(platform.ensureComment).not.toHaveBeenCalled();
    });
  });

  it('checks git file list for config file when in fork mode', async () => {
    config.forkToken = 'token';
    cache.getCache.mockReturnValue({ configFileName: 'renovate.json' });
    scm.getFileList.mockResolvedValue([]);
    await isOnboarded(config);
    expect(platform.getJsonFile).not.toHaveBeenCalled();
    expect(scm.getFileList).toHaveBeenCalled();
  });
});
