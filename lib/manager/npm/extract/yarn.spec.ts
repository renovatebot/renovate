import { fs, getName, loadFixture } from '../../../../test/util';
import { getYarnLock } from './yarn';

jest.mock('../../../util/fs');

describe(getName(), () => {
  describe('.getYarnLock()', () => {
    it('returns empty if exception parsing', async () => {
      fs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBe(true);
      expect(Object.keys(res.lockedVersions)).toHaveLength(0);
    });

    it('extracts yarn 1', async () => {
      const plocktest1Lock = loadFixture('plocktest1/yarn.lock', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBe(true);
      expect(res.lockfileVersion).toBeUndefined();
      expect(res.lockedVersions).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions)).toHaveLength(7);
    });

    it('extracts yarn 2', async () => {
      const plocktest1Lock = loadFixture('yarn2/yarn.lock', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBe(false);
      expect(res.lockfileVersion).toBe(NaN);
      expect(res.lockedVersions).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions)).toHaveLength(8);
    });

    it('extracts yarn 2 cache version', async () => {
      const plocktest1Lock = loadFixture('yarn2.2/yarn.lock', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBe(false);
      expect(res.lockfileVersion).toBe(6);
      expect(res.lockedVersions).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions)).toHaveLength(10);
    });
  });
});
