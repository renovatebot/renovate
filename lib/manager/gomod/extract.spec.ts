import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const gomod1 = loadFixture('1/go.mod');
const gomod2 = loadFixture('2/go.mod');
const gomod3 = loadFixture('3/go.mod');

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts single-line requires', () => {
      const res = extractPackageFile(gomod1).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(8);
      expect(res.filter((e) => e.skipReason)).toHaveLength(1);
      expect(res.filter((e) => e.depType === 'replace')).toHaveLength(1);
    });
    it('extracts constraints', () => {
      const res = extractPackageFile(gomod3);
      expect(res).toMatchSnapshot();
      expect(res.constraints.go).toEqual('^1.13');
    });
    it('extracts multi-line requires', () => {
      const res = extractPackageFile(gomod2).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(58);
      expect(res.filter((e) => e.skipReason)).toHaveLength(0);
    });
  });
});
