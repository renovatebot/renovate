import { RenovateConfig, scm } from '../../../../../test/util';
import { getConfig } from '../../../../config/defaults';
import { GlobalConfig } from '../../../../config/global';
import * as memCache from '../../../../util/cache/memory';
import { toSha256 } from '../../../../util/hash';
import { rebaseOnboardingBranch } from './rebase';

describe('workers/repository/onboarding/branch/rebase', () => {
  beforeAll(() => {
    GlobalConfig.set({
      localDir: '',
    });
  });

  describe('rebaseOnboardingBranch()', () => {
    let config: RenovateConfig;
    const hash = '';

    beforeEach(() => {
      memCache.init();
      jest.resetAllMocks();
      config = {
        ...getConfig(),
        repository: 'some/repo',
      };
    });

    it('does nothing if branch is up to date', async () => {
      const contents =
        JSON.stringify(getConfig().onboardingConfig, null, 2) + '\n';
      await rebaseOnboardingBranch(config, toSha256(contents));
      expect(scm.commitAndPush).toHaveBeenCalledTimes(0);
    });

    it('rebases onboarding branch', async () => {
      await rebaseOnboardingBranch(config, hash);
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
    });

    it('uses the onboardingConfigFileName if set', async () => {
      await rebaseOnboardingBranch({
        ...config,
        onboardingConfigFileName: '.github/renovate.json',
      });
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
      expect(scm.commitAndPush.mock.calls[0][0].message).toContain(
        '.github/renovate.json'
      );
      expect(scm.commitAndPush.mock.calls[0][0].files[0].path).toBe(
        '.github/renovate.json'
      );
    });

    it('falls back to "renovate.json" if onboardingConfigFileName is not set', async () => {
      await rebaseOnboardingBranch({
        ...config,
        onboardingConfigFileName: undefined,
      });
      expect(scm.commitAndPush).toHaveBeenCalledTimes(1);
      expect(scm.commitAndPush.mock.calls[0][0].message).toContain(
        'renovate.json'
      );
      expect(scm.commitAndPush.mock.calls[0][0].files[0].path).toBe(
        'renovate.json'
      );
    });

    describe('handle onboarding config hashes', () => {
      const contents =
        JSON.stringify(getConfig().onboardingConfig, null, 2) + '\n';

      it('handles a missing previous config hash', async () => {
        await rebaseOnboardingBranch(config, undefined);
      });

      it('does nothing if config hashes match', async () => {
        await rebaseOnboardingBranch(config, toSha256(contents));
      });

      it('requests update if config hashes mismatch', async () => {
        await rebaseOnboardingBranch(config, hash);
      });
    });
  });
});
