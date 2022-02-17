import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('manager/buildkite/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts simple single plugin', () => {
      const res = extractPackageFile(Fixtures.get('pipeline1.yml')).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('extracts multiple plugins in same file', () => {
      const res = extractPackageFile(Fixtures.get('pipeline2.yml')).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('adds skipReason', () => {
      const res = extractPackageFile(Fixtures.get('pipeline3.yml')).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('extracts arrays of plugins', () => {
      const res = extractPackageFile(Fixtures.get('pipeline4.yml')).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });
    it('extracts git-based plugins', () => {
      const res = extractPackageFile(Fixtures.get('pipeline5.yml')).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('extracts git-based plugin with .git at the end of its name', () => {
      const res = extractPackageFile(Fixtures.get('pipeline6.yml')).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
  });
});
