import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

const gomod1 = readFileSync('lib/manager/gomod/__fixtures__/1/go.mod', 'utf8');
const gomod2 = readFileSync('lib/manager/gomod/__fixtures__/2/go.mod', 'utf8');
const gomod3 = readFileSync('lib/manager/gomod/__fixtures__/3/go.mod', 'utf8');

describe(getName(__filename), () => {
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
      expect(res.constraints.go).toEqual('1.13');
    });
    it('extracts multi-line requires', () => {
      const res = extractPackageFile(gomod2).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(58);
      expect(res.filter((e) => e.skipReason)).toHaveLength(0);
    });
  });
});
