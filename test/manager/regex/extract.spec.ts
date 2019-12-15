import {
  RegexManagerConfig,
  extractPackageFile,
} from '../../../lib/manager/regex/extract';

describe('lib/manager/regex/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null if missing fields', () => {
      const config: RegexManagerConfig = {
        extractRegex: '',
        depName: '',
        currentValue: '',
        datasource: '',
        versionScheme: null,
      };
      const res = extractPackageFile('', '', config);
      expect(res).toBeNull();
    });
    it('matches', () => {
      const config: RegexManagerConfig = {
        extractRegex: '(?<depName>.*?)=(?<currentValue>.*?)\n',
        depName: '{{depName}}',
        currentValue: '{{currentValue}}',
        datasource: 'npm',
        versionScheme: 'semver',
      };
      const res = extractPackageFile(
        'lodash=4.0.0\nexpress=4.0.0\n',
        '',
        config
      );
      expect(res).toBeNull();
    });
  });
});
