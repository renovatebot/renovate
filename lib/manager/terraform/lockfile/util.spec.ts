import { readFileSync } from 'fs';
import { getName } from '../../../../test/util';
import { extractLocks } from './util';

const validLockfile = readFileSync(
  'lib/manager/terraform/lockfile/__fixtures__/validLockfile.hcl',
  'utf8'
);

describe(getName(), () => {
  describe('extractLocks()', () => {
    it('returns null for empty', () => {
      const result = extractLocks('nothing here');
      expect(result).toBeNull();
    });
    it('extracts', () => {
      const res = extractLocks(validLockfile);
      expect(res).toHaveLength(3);
      expect(res).toMatchSnapshot();
    });
  });
});
