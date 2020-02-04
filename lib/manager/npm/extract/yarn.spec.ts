import { readFileSync } from 'fs';
import { getYarnLock } from './yarn';
import { platform as _platform } from '../../../platform';

const platform: any = _platform;

describe('manager/npm/extract/yarn', () => {
  describe('.getYarnLock()', () => {
    it('returns empty if exception parsing', async () => {
      platform.getFile.mockReturnValueOnce('abcd');
      const res = await getYarnLock('package.json');
      expect(Object.keys(res)).toHaveLength(0);
    });
    it('extracts', async () => {
      const plocktest1Lock = readFileSync(
        'test/config/npm/__fixtures__/plocktest1/yarn.lock',
        'utf8'
      );
      platform.getFile.mockReturnValueOnce(plocktest1Lock);
      const res = await getYarnLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).toHaveLength(7);
    });
  });
});
