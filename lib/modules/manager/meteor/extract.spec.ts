import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const input01Content = Fixtures.get('package-1.js');

describe('modules/manager/meteor/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n');
      expect(res).toBeNull();
    });

    it('returns results', () => {
      const res = extractPackageFile(input01Content);
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(6);
    });
  });
});
