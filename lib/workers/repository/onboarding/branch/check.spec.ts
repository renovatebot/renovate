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
  const config = partial<RenovateConfig>({
    requireConfig: 'required',
    suppressNotifications: [],
    onboarding: true,
  });

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

  describe('platform-specific config detection', () => {
    beforeEach(() => {
      cache.getCache.mockReturnValue({});
      platform.findPr.mockResolvedValue(null);
    });

    afterEach(() => {
      GlobalConfig.reset();
    });

    it('detects .github config only on github platform', async () => {
      GlobalConfig.set({ platform: 'github' });
      const fileList = [
        'package.json',
        '.github/renovate.json',
        '.gitlab/renovate.json',
      ];
      scm.getFileList.mockResolvedValue(fileList);
      platform.ensureIssueClosing.mockResolvedValue();
      
      const result = await isOnboarded(config);
      expect(result).toBeTrue();
      expect(logger.debug).toHaveBeenCalledWith(
        'Config file exists, fileName: .github/renovate.json',
      );
    });

    it('detects .gitlab config only on gitlab platform', async () => {
      GlobalConfig.set({ platform: 'gitlab' });
      const fileList = [
        'package.json',
        '.github/renovate.json',
        '.gitlab/renovate.json',
      ];
      scm.getFileList.mockResolvedValue(fileList);
      platform.ensureIssueClosing.mockResolvedValue();
      
      const result = await isOnboarded(config);
      expect(result).toBeTrue();
      expect(logger.debug).toHaveBeenCalledWith(
        'Config file exists, fileName: .gitlab/renovate.json',
      );
    });

    it('ignores platform-specific configs on different platform', async () => {
      GlobalConfig.set({ platform: 'bitbucket' });
      const fileList = [
        'package.json',
        '.github/renovate.json',
        '.gitlab/renovate.json',
      ];
      scm.getFileList.mockResolvedValue(fileList);
      
      const result = await isOnboarded(config);
      expect(result).toBeFalse();
      expect(logger.debug).toHaveBeenCalledWith('config file not found');
    });

    it('always detects root-level config files regardless of platform', async () => {
      GlobalConfig.set({ platform: 'bitbucket' });
      const fileList = [
        'package.json',
        '.github/renovate.json',
        '.gitlab/renovate.json',
        'renovate.json',
      ];
      scm.getFileList.mockResolvedValue(fileList);
      platform.ensureIssueClosing.mockResolvedValue();
      
      const result = await isOnboarded(config);
      expect(result).toBeTrue();
      expect(logger.debug).toHaveBeenCalledWith(
        'Config file exists, fileName: renovate.json',
      );
    });
  });
});
