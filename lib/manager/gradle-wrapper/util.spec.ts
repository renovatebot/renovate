import { setGlobalConfig } from '../../config/global';
import { extractGradleVersion, getJavaContraint } from './utils';

describe('manager/gradle-wrapper/util', () => {
  describe('getJavaContraint()', () => {
    it('return null for global mode', () => {
      expect(getJavaContraint(undefined)).toBeNull();
    });

    it('return ^11.0.0 for docker mode and undefined gradle', () => {
      setGlobalConfig({ binarySource: 'docker' });
      expect(getJavaContraint(undefined)).toEqual('^11.0.0');
    });

    it('return ^8.0.0 for docker gradle < 5', () => {
      setGlobalConfig({ binarySource: 'docker' });
      expect(getJavaContraint('4.9')).toEqual('^8.0.0');
    });

    it('return ^11.0.0 for docker gradle >=5 && <7', () => {
      setGlobalConfig({ binarySource: 'docker' });
      expect(getJavaContraint('6.0')).toEqual('^11.0.0');
    });

    it('return ^16.0.0 for docker gradle >= 7', () => {
      setGlobalConfig({ binarySource: 'docker' });
      expect(getJavaContraint('7.0.1')).toEqual('^16.0.0');
    });
  });

  describe('extractGradleVersion()', () => {
    it('works for undefined', () => {
      expect(extractGradleVersion(undefined)).toBeNull();
    });
  });
});
