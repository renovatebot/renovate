import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const pipeline1 = loadFixture(__filename, 'pipeline1.yml');
const pipeline2 = loadFixture(__filename, 'pipeline2.yml');
const pipeline3 = loadFixture(__filename, 'pipeline3.yml');
const pipeline4 = loadFixture(__filename, 'pipeline4.yml');

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts simple single plugin', () => {
      const res = extractPackageFile(pipeline1).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('extracts multiple plugins in same file', () => {
      const res = extractPackageFile(pipeline2).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('adds skipReason', () => {
      const res = extractPackageFile(pipeline3).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
    });
    it('extracts arrays of plugins', () => {
      const res = extractPackageFile(pipeline4).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });
  });
});
