import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('manager/setup-cfg/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(Fixtures.get('setup-cfg-1.txt'));
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
  });
});
