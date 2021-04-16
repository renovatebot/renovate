import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

function readFixture(fixture: string) {
  return readFileSync(resolve(__dirname, `./__fixtures__/${fixture}`), 'utf8');
}

const input01Content = readFixture('package-1.js');

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n');
      expect(res).toBeNull();
    });
    it('returns results', () => {
      const res = extractPackageFile(input01Content);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });
  });
});
