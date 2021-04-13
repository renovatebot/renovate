import { readFileSync } from 'fs';
import { fs, getName } from '../../../../test/util';
import { getNpmLock } from './npm';

jest.mock('../../../util/fs');

describe(getName(__filename), () => {
  describe('.getNpmLock()', () => {
    it('returns empty if failed to parse', async () => {
      fs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res.lockedVersions)).toHaveLength(0);
    });
    it('extracts', async () => {
      const plocktest1Lock = readFileSync(
        'lib/manager/npm/__fixtures__/plocktest1/package-lock.json'
      );
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock as never);
      const res = await getNpmLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions)).toHaveLength(7);
    });
    it('extracts npm 7 lockfile', async () => {
      const npm7Lock = readFileSync(
        'lib/manager/npm/__fixtures__/npm7/package-lock.json'
      );
      fs.readLocalFile.mockResolvedValueOnce(npm7Lock as never);
      const res = await getNpmLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res.lockedVersions)).toHaveLength(7);
      expect(res.lockfileVersion).toEqual(2);
    });
    it('returns empty if no deps', async () => {
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res.lockedVersions)).toHaveLength(0);
    });
  });
});
