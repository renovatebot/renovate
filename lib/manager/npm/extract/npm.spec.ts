import { readFileSync } from 'fs';
import { getNpmLock } from './npm';
import * as _fs from '../../../util/fs';

jest.mock('../../../util/fs');

const fs: any = _fs;

describe('manager/npm/extract/npm', () => {
  describe('.getNpmLock()', () => {
    it('returns empty if failed to parse', async () => {
      fs.readLocalFile.mockReturnValueOnce('abcd');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res)).toHaveLength(0);
    });
    it('extracts', async () => {
      const plocktest1Lock = readFileSync(
        'lib/manager/npm/__fixtures__/plocktest1/package-lock.json'
      );
      fs.readLocalFile.mockReturnValueOnce(plocktest1Lock);
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
