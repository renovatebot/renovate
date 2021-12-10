import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from './extract';

const content = Fixtures.get('setup-cfg-1.txt');

describe('manager/setup-cfg/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(content);
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
  });
});
