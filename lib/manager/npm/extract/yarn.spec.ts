import { readFileSync } from 'fs';
import { getYarnLock } from './yarn';
import * as _fs from '../../../util/fs';

jest.mock('../../../util/fs');

const fs: any = _fs;

describe('manager/npm/extract/yarn', () => {
  describe('.getYarnLock()', () => {
    it('returns empty if exception parsing', async () => {
      fs.readLocalFile.mockReturnValueOnce('abcd');
      const res = await getYarnLock('package.json');
      expect(Object.keys(res)).toHaveLength(0);
    });
    it('extracts', async () => {
      const plocktest1Lock = readFileSync(
        'lib/manager/npm/__fixtures__/plocktest1/yarn.lock',
        'utf8'
      );
      fs.readLocalFile.mockReturnValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).toHaveLength(7);
    });
  });
});
