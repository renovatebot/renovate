import { ExperimentalFlag, GlobalConfig } from './global';

describe('config/experimental-flags', () => {
  describe('experimentalFlagValue()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('returns null if flag not found', () => {
      GlobalConfig.set({
        experimentalFlags: ['dockerMaxPages=19'],
      });
      expect(ExperimentalFlag.get('dockerHubTags')).toBeNull();
    });

    it('returns null if experimentalFlags is undefined', () => {
      expect(ExperimentalFlag.get('dockerHubTags')).toBeNull();
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
      expect(ExperimentalFlag.get('dockerHubTags')).toBe('dockerHubTags');
      expect(ExperimentalFlag.get('dockerHubTags')).toBe('dockerHubTags'); // validate caching
      expect(ExperimentalFlag.get('dockerMaxPages')).toBe('19');
      expect(ExperimentalFlag.get('mergeConfidenceSupportedDatasources')).toBe(
        '["docker"]',
      );
      expect(ExperimentalFlag.get('autoDiscoverRepoOrder')).toBe('desc');
    });
  });
});
