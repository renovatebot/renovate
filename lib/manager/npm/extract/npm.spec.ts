import { readFileSync } from 'fs';
import { fs } from '../../../../test/util';
import { getNpmLock } from './npm';

jest.mock('../../../util/fs');

describe('manager/npm/extract/npm', () => {
  describe('.getNpmLock()', () => {
    it('returns empty if failed to parse', async () => {
      fs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res)).toHaveLength(0);
    });
    it('extracts', async () => {
      const plocktest1Lock = readFileSync(
        'lib/manager/npm/__fixtures__/plocktest1/package-lock.json'
      );
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock as never);
      const res = await getNpmLock('package.json');
      expect(res).toMatchSnapshot();
      expect(Object.keys(res)).toHaveLength(7);
    });
    it('returns empty if no deps', async () => {
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res)).toHaveLength(0);
    });
  });
});
