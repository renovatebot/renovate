import { Fixtures } from '../../../../test/fixtures';
import { extractLocks } from './util';

const validLockfile = Fixtures.get('validLockfile.hcl');

describe('manager/terraform/lockfile/util', () => {
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
