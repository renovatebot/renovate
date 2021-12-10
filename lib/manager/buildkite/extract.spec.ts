import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from './extract';

const pipeline1 = Fixtures.get('pipeline1.yml');
const pipeline2 = Fixtures.get('pipeline2.yml');
const pipeline3 = Fixtures.get('pipeline3.yml');
const pipeline4 = Fixtures.get('pipeline4.yml');

describe('manager/buildkite/extract', () => {
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
