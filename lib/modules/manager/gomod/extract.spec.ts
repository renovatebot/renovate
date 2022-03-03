import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

const gomod1 = Fixtures.get('1/go.mod');
const gomod2 = Fixtures.get('2/go.mod');
const gomod3 = Fixtures.get('3/go.mod');

describe('modules/manager/gomod/extract', () => {
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
      expect(res.constraints.go).toBe('^1.13');
    });
    it('extracts multi-line requires', () => {
      const res = extractPackageFile(gomod2).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(58);
      expect(res.filter((e) => e.skipReason)).toHaveLength(0);
    });
  });
});
