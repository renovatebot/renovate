import { Fixtures } from '../../../../test/fixtures';
import { extractPerlVersion } from './common';

const cpanfile = Fixtures.get('cpanfile.plack');

describe('modules/manager/cpanfile/common', () => {
  describe('extractPerlVersion', () => {
    it('extracts minimum required Perl version', () => {
      const version = extractPerlVersion(cpanfile);
      expect(version).toBe('5.008001');
    });
  });
});
