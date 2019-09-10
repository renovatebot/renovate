import { readFileSync } from 'fs';
import { getNpmLock } from '../../../../lib/manager/npm/extract/npm';
import { platform as _platform } from '../../../../lib/platform';

const platform: any = _platform;

describe('manager/npm/extract/npm', () => {
  describe('.getNpmLock()', () => {
    it('returns empty if failed to parse', async () => {
      platform.getFile.mockReturnValueOnce('abcd');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res)).toHaveLength(0);
    });
    it('extracts', async () => {
      const plocktest1Lock = readFileSync(
        'test/config/npm/_fixtures/plocktest1/package-lock.json'
      );
      platform.getFile.mockReturnValueOnce(plocktest1Lock);
      const res = await getNpmLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).toHaveLength(7);
    });
    it('returns empty if no deps', async () => {
      platform.getFile.mockResolvedValueOnce('{}');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res)).toHaveLength(0);
    });
  });
});
