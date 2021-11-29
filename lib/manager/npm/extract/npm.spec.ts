import { fs, loadFixture } from '../../../../test/util';
import { getNpmLock } from './npm';

jest.mock('../../../util/fs');

describe('manager/npm/extract/npm', () => {
  describe('.getNpmLock()', () => {
    it('returns empty if failed to parse', async () => {
      fs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res.lockedVersions)).toHaveLength(0);
    });
    it('extracts', async () => {
      const plocktest1Lock = loadFixture('plocktest1/package-lock.json', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock as never);
      const res = await getNpmLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions)).toHaveLength(7);
    });
    it('extracts npm 7 lockfile', async () => {
      const npm7Lock = loadFixture('npm7/package-lock.json', '..');
      fs.readLocalFile.mockResolvedValueOnce(npm7Lock as never);
      const res = await getNpmLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions)).toHaveLength(7);
      expect(res.lockfileVersion).toBe(2);
    });
    it('returns empty if no deps', async () => {
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res.lockedVersions)).toHaveLength(0);
    });
  });
});
