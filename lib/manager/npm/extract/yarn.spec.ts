import { readFileSync } from 'fs';
import { fs, getName } from '../../../../test/util';
import { getYarnLock } from './yarn';

jest.mock('../../../util/fs');

describe(getName(__filename), () => {
  describe('.getYarnLock()', () => {
    it('returns empty if exception parsing', async () => {
      fs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBe(true);
      expect(Object.keys(res.lockedVersions)).toHaveLength(0);
    });

    it('extracts yarn 1', async () => {
      const plocktest1Lock = readFileSync(
        'lib/manager/npm/__fixtures__/plocktest1/yarn.lock',
        'utf8'
      );
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBe(true);
      expect(res.lockfileVersion).toBeUndefined();
      expect(res.lockedVersions).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions)).toHaveLength(7);
    });

    it('extracts yarn 2', async () => {
      const plocktest1Lock = readFileSync(
        'lib/manager/npm/__fixtures__/yarn2/yarn.lock',
        'utf8'
      );
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBe(false);
      expect(res.lockfileVersion).toBe(NaN);
      expect(res.lockedVersions).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions)).toHaveLength(8);
    });

    it('extracts yarn 2 cache version', async () => {
      const plocktest1Lock = readFileSync(
        'lib/manager/npm/__fixtures__/yarn2.2/yarn.lock',
        'utf8'
      );
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res.isYarn1).toBe(false);
      expect(res.lockfileVersion).toBe(6);
      expect(res.lockedVersions).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions)).toHaveLength(10);
    });
  });
});
