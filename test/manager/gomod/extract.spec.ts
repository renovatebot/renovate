import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/gomod/extract';

const gomod1 = readFileSync('test/manager/gomod/_fixtures/1/go.mod', 'utf8');
const gomod2 = readFileSync('test/manager/gomod/_fixtures/2/go.mod', 'utf8');

describe('lib/manager/gomod/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts single-line requires', () => {
      const res = extractPackageFile(gomod1).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(8);
      expect(res.filter(e => e.skipReason)).toHaveLength(1);
      expect(res.filter(e => e.depType === 'replace')).toHaveLength(1);
    });
    it('extracts multi-line requires', () => {
      const res = extractPackageFile(gomod2).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(58);
      expect(res.filter(e => e.skipReason)).toHaveLength(0);
    });
  });
});
