import { Fixtures } from '../../../../../test/fixtures';
import { fs } from '../../../../../test/util';
import { getNpmLock } from './npm';

jest.mock('../../../../util/fs');

describe('modules/manager/npm/extract/npm', () => {
  describe('.getNpmLock()', () => {
    it('returns null if failed to parse', async () => {
      fs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res.lockedVersions!)).toHaveLength(0);
    });

    it('extracts', async () => {
      const plocktest1Lock = Fixtures.get('plocktest1/package-lock.json', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock as never);
      const res = await getNpmLock('package.json');
      expect(res).toEqual({
        lockedVersions: {
          'ansi-styles': '3.2.1',
          chalk: '2.4.1',
          'color-convert': '1.9.1',
          'color-name': '1.1.3',
          'escape-string-regexp': '1.0.5',
          'has-flag': '3.0.0',
          'supports-color': '5.4.0',
        },
        lockfileVersion: 1,
      });
    });

    it('extracts npm 7 lockfile', async () => {
      const npm7Lock = Fixtures.get('npm7/package-lock.json', '..');
      fs.readLocalFile.mockResolvedValueOnce(npm7Lock as never);
      const res = await getNpmLock('package.json');
      expect(res).toEqual({
        lockedVersions: {
          'ansi-styles': '3.2.1',
          chalk: '2.4.1',
          'color-convert': '1.9.1',
          'color-name': '1.1.3',
          'escape-string-regexp': '1.0.5',
          'has-flag': '3.0.0',
          'supports-color': '5.4.0',
        },
        lockfileVersion: 2,
      });
    });

    it('extracts npm 9 lockfile', async () => {
      const npm9Lock = Fixtures.get('npm9/package-lock.json', '..');
      fs.readLocalFile.mockResolvedValueOnce(npm9Lock);
      const res = await getNpmLock('package.json');
      expect(res).toEqual({
        lockedVersions: {
          'ansi-styles': '3.2.1',
          chalk: '2.4.2',
          'color-convert': '1.9.3',
          'color-name': '1.1.3',
          'escape-string-regexp': '1.0.5',
          'has-flag': '3.0.0',
          'supports-color': '5.5.0',
        },
        lockfileVersion: 3,
      });
    });

    it('returns null if no deps', async () => {
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res.lockedVersions!)).toHaveLength(0);
    });

    it('returns null on read error', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const res = await getNpmLock('package.json');
      expect(Object.keys(res.lockedVersions!)).toHaveLength(0);
    });
  });
});
