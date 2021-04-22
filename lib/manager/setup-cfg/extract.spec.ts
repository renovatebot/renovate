import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const content = loadFixture(__filename, 'setup-cfg-1.txt');

describe(getName(__filename), () => {
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
