import { GlobalConfig } from '../../../../config/global';
import { REPOSITORY_CLOSED_ONBOARDING } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import type { Pr } from '../../../../modules/platform/types';
import * as _cache from '../../../../util/cache/repository';
import type { LongCommitSha } from '../../../../util/git/types';
import { isOnboarded } from './check';
import { git, partial, platform, scm } from '~test/util';
import type { RenovateConfig } from '~test/util';

vi.mock('../../../../util/cache/repository');

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

  // incase pr was autolcosed becasue if it passing the onboardingAutoCloseAge
  it('continues with normal logic if closedPr exists - skips closing comment', async () => {
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

  it('checks git file list for config file when in fork mode', async () => {
    config.forkToken = 'token';
    cache.getCache.mockReturnValue({ configFileName: 'renovate.json' });
    scm.getFileList.mockResolvedValue([]);
    await isOnboarded(config);
    expect(platform.getJsonFile).not.toHaveBeenCalled();
    expect(scm.getFileList).toHaveBeenCalled();
  });
});
