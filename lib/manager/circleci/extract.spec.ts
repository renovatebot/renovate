import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const file1 = loadFixture(__filename, 'config.yml');
const file2 = loadFixture(__filename, 'config2.yml');
const file3 = loadFixture(__filename, 'config3.yml');

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(file1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
    it('extracts orbs too', () => {
      const res = extractPackageFile(file2);
      expect(res.deps).toMatchSnapshot();
      // expect(res.deps).toHaveLength(4);
    });
    it('extracts image without leading dash', () => {
      const res = extractPackageFile(file3);
      expect(res.deps).toMatchSnapshot();
    });
  });
});
