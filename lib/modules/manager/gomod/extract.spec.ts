import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const gomod1 = Fixtures.get('1/go.mod');
const gomod2 = Fixtures.get('2/go.mod');
const gomod3 = Fixtures.get('3/go.mod');

describe('modules/manager/gomod/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts single-line requires', () => {
      const res = extractPackageFile(gomod1)?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(8);
      expect(res?.filter((e) => e.skipReason)).toHaveLength(1);
      expect(res?.filter((e) => e.depType === 'replace')).toHaveLength(1);
    });

    it('extracts constraints and golang', () => {
      const res = extractPackageFile(gomod3);
      expect(res?.deps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            depType: 'golang',
            depName: 'go',
            datasource: 'golang-version',
            rangeStrategy: 'replace',
          }),
        ])
      );
      expect(res?.extractedConstraints?.go).toBe('^1.13');
    });

    it('extracts multi-line requires', () => {
      const res = extractPackageFile(gomod2)?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(58);
      expect(res?.filter((e) => e.skipReason)).toHaveLength(0);
    });
  });
});
