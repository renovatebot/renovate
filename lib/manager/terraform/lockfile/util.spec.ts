import { getName, loadFixture } from '../../../../test/util';
import { extractLocks } from './util';

const validLockfile = loadFixture('validLockfile.hcl');

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
