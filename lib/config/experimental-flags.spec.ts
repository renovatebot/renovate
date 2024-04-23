import { GlobalConfig } from './global';

describe('config/experimental-flags', () => {
  describe('experimentalFlagValue()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('returns true if flag set', () => {
      GlobalConfig.set({
        experimentalFlags: ['dockerHubTags'],
      });
      expect(GlobalConfig.getExperimentalFlag('dockerHubTags')).toBeTrue();
    });

    it('returns false if flag not set', () => {
      GlobalConfig.set({
        experimentalFlags: ['some-other-flag'],
      });
      expect(GlobalConfig.getExperimentalFlag('dockerHubTags')).toBeFalse();
    });

    it('returns false if experimentalFlags is undefined', () => {
      expect(GlobalConfig.getExperimentalFlag('dockerHubTags')).toBeFalse();
    });
  });
});
