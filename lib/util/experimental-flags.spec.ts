import { GlobalConfig } from '../config/global';
import { experimentalFlagValue } from './experimental-flags';

describe('util/experimental-flags', () => {
  describe('experimentalFlagValue()', () => {
    beforeEach(() => {
      GlobalConfig.reset();
    });

    it('returns null if flag not found', () => {
      GlobalConfig.set({
        experimentalFlags: ['dockerMaxPages=19'],
      });
      expect(experimentalFlagValue('dockerHubTags')).toBeNull();
    });

    it('returns null if experimentalFlags is undefined', () => {
      expect(experimentalFlagValue('dockerHubTags')).toBeNull();
    });

    it('returns value', () => {
      GlobalConfig.set({
        experimentalFlags: ['dockerHubTags', 'dockerMaxPages=19'],
      });
      expect(experimentalFlagValue('dockerHubTags')).toBe('dockerHubTags');
      expect(experimentalFlagValue('dockerHubTags')).toBe('dockerHubTags'); // validate caching
      expect(experimentalFlagValue('dockerMaxPages')).toBe('19');
      expect(experimentalFlagValue('dockerMaxPages')).toBe('19'); // coverage for stored values
    });
  });
});
