import { GlobalConfig } from '../../config/global';
import { extractGradleVersion, getJavaContraint } from './utils';

describe('manager/gradle-wrapper/util', () => {
  describe('getJavaContraint()', () => {
    it('return null for global mode', () => {
      expect(getJavaContraint(undefined)).toBeNull();
    });

    it('return ^11.0.0 for docker mode and undefined gradle', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaContraint(undefined)).toBe('^11.0.0');
    });

    it('return ^8.0.0 for docker gradle < 5', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaContraint('4.9')).toBe('^8.0.0');
    });

    it('return ^11.0.0 for docker gradle >=5 && <7', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaContraint('6.0')).toBe('^11.0.0');
    });

    it('return ^16.0.0 for docker gradle >= 7', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaContraint('7.0.1')).toBe('^16.0.0');
    });
  });

  describe('extractGradleVersion()', () => {
    it('works for undefined', () => {
      expect(extractGradleVersion(undefined)).toBeNull();
    });
  });
});
