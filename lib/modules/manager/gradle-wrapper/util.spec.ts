import { GlobalConfig } from '../../../config/global';
import { extractGradleVersion, getJavaConstraint } from './utils';

describe('modules/manager/gradle-wrapper/util', () => {
  describe('getJavaConstraint()', () => {
    it('return ^8.0.0 for global mode', () => {
      expect(getJavaConstraint('4')).toBe('^8.0.0');
    });

    it('return ^11.0.0 for docker mode and undefined gradle', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaConstraint('')).toBe('^11.0.0');
    });

    it('return ^8.0.0 for docker gradle < 5', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaConstraint('4.9')).toBe('^8.0.0');
    });

    it('return ^11.0.0 for docker gradle >=5 && <7', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaConstraint('6.0')).toBe('^11.0.0');
    });

    it('return ^16.0.0 for docker gradle >= 7', () => {
      GlobalConfig.set({ binarySource: 'docker' });
      expect(getJavaConstraint('7.0.1')).toBe('^16.0.0');
    });
  });

  describe('extractGradleVersion()', () => {
    it('works for undefined', () => {
      // TODO #7154
      expect(extractGradleVersion(undefined as never)).toBeNull();
    });
  });
});
