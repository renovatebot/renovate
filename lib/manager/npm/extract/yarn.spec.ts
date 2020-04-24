import { readFileSync } from 'fs';
import { fs } from '../../../../test/util';
import { getYarnLock } from './yarn';

jest.mock('../../../util/fs');

describe('manager/npm/extract/yarn', () => {
  describe('.getYarnLock()', () => {
    it('returns empty if exception parsing', async () => {
      fs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getYarnLock('package.json');
      expect(Object.keys(res)).toHaveLength(0);
    });

    it('extracts yarn 1', async () => {
      const plocktest1Lock = readFileSync(
        'lib/manager/npm/__fixtures__/plocktest1/yarn.lock',
        'utf8'
      );
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).toHaveLength(7);
    });

    it('extracts yarn 2', async () => {
      const plocktest1Lock = readFileSync(
        'lib/manager/npm/__fixtures__/yarn2/yarn.lock',
        'utf8'
      );
      fs.readLocalFile.mockReturnValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).toHaveLength(8);
    });
  });
});
