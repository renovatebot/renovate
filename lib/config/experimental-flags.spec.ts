import { GlobalConfig } from './global';

describe('config/experimental-flags', () => {
  describe('experimentalFlagValue()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('returns null if flag not found', () => {
      GlobalConfig.set({
        experimentalFlags: ['dockerMaxPages=19'],
      });
      expect(GlobalConfig.getExperimentalFlag('dockerHubTags')).toBeNull();
    });

    it('returns null if experimentalFlags is undefined', () => {
      expect(GlobalConfig.getExperimentalFlag('dockerHubTags')).toBeNull();
    });

    it('returns value', () => {
      GlobalConfig.set({
        experimentalFlags: [
          'dockerHubTags',
          'dockerMaxPages=19',
          'mergeConfidenceSupportedDatasources=["docker"]',
          'autoDiscoverRepoOrder=desc',
        ],
      });
      expect(GlobalConfig.getExperimentalFlag('dockerHubTags')).toBe(
        'dockerHubTags',
      );
      expect(GlobalConfig.getExperimentalFlag('dockerHubTags')).toBe(
        'dockerHubTags',
      ); // validate caching
      expect(GlobalConfig.getExperimentalFlag('dockerMaxPages')).toBe('19');
      expect(
        GlobalConfig.getExperimentalFlag('mergeConfidenceSupportedDatasources'),
      ).toBe('["docker"]');
      expect(GlobalConfig.getExperimentalFlag('autoDiscoverRepoOrder')).toBe(
        'desc',
      );
    });
  });
});
