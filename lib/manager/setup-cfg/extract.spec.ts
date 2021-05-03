import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const content = loadFixture('setup-cfg-1.txt');

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(content);
      expect(res).toMatchSnapshot();
    });
  });
});
