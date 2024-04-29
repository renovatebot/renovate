import { GlobalConfig } from './global';

describe('config/experimental-flags', () => {
  describe('experimentalFlagValue()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('returns true if flag set', () => {
      GlobalConfig.set({
        experimentalFlags: ['disableDockerHubTags'],
      });
      expect(
        GlobalConfig.getExperimentalFlag('disableDockerHubTags'),
      ).toBeTrue();
    });

    it('returns false if flag not set', () => {
      GlobalConfig.set({
        experimentalFlags: ['some-other-flag'],
      });
      expect(
        GlobalConfig.getExperimentalFlag('disableDockerHubTags'),
      ).toBeFalse();
    });

    it('returns false if experimentalFlags is undefined', () => {
      expect(
        GlobalConfig.getExperimentalFlag('disableDockerHubTags'),
      ).toBeFalse();
    });
  });
});
