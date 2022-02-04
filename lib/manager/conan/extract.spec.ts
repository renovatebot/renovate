import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from '.';

const conanfile1 = Fixtures.get('conanfile.txt');
const conanfile2 = Fixtures.get('conanfile2.txt');
const conanfile3 = Fixtures.get('conanfile.py');

describe('manager/conan/extract', () => {
  describe('extractPackageFile', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines from conanfile.txt', () => {
      const res = extractPackageFile(conanfile1);
      expect(res?.deps).toHaveLength(10);
    });
    it('extracts multiple 0 lines from conanfile.txt', () => {
      const res = extractPackageFile(conanfile2);
      expect(res).toBeNull();
    });
    it('extracts multiple image lines from conanfile.py', () => {
      const res = extractPackageFile(conanfile3);
      expect(res?.deps).toHaveLength(16);
    });
  });
});
