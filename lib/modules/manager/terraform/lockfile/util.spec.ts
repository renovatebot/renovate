import { Fixtures } from '../../../../../test/fixtures';
import { extractLocks } from './util';

describe('modules/manager/terraform/lockfile/util', () => {
  describe('extractLocks()', () => {
    it('returns null for empty', () => {
      const result = extractLocks('nothing here');
      expect(result).toBeNull();
    });

    it('extracts', () => {
      const res = extractLocks(Fixtures.get('validLockfile.hcl'));
      expect(res).toHaveLength(3);
      expect(res).toMatchSnapshot();
    });
  });
});
