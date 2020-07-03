import { readFileSync } from 'fs';
import { gitfs } from '../../../../test/util';
import { getYarnLock } from './yarn';

jest.mock('../../../util/git/fs');

describe('manager/npm/extract/yarn', () => {
  describe('.getYarnLock()', () => {
    it('returns empty if exception parsing', async () => {
      gitfs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getYarnLock('package.json');
      expect(Object.keys(res)).toHaveLength(0);
    });
    it('extracts', async () => {
      const plocktest1Lock = readFileSync(
        'lib/manager/npm/__fixtures__/plocktest1/yarn.lock',
        'utf8'
      );
      gitfs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).toHaveLength(7);
    });
  });
});
