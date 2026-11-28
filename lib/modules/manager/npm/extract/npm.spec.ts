import { Fixtures } from '~test/fixtures.ts';
import { fs } from '~test/util.ts';
import { getNpmLock } from './npm.ts';

vi.mock('../../../../util/fs/index.ts');

describe('modules/manager/npm/extract/npm', () => {
  describe('.getNpmLock()', () => {
    it('returns null if failed to parse', async () => {
      fs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res.lockedVersions!)).toHaveLength(0);
    });

    it('extracts', async () => {
      const plocktest1Lock = Fixtures.get('plocktest1/package-lock.json', '..');
      fs.readLocalFile.mockResolvedValueOnce(plocktest1Lock);
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
      fs.readLocalFile.mockResolvedValueOnce(npm7Lock);
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

    it('keeps workspace paths from the packages section of a v2 lockfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          lockfileVersion: 2,
          packages: {
            '': { name: 'root', workspaces: ['packages/*'] },
            'node_modules/abbrev': { version: '1.1.1' },
            'node_modules/a': { resolved: 'packages/a', link: true },
            'packages/a': { name: 'a', version: '1.0.0' },
            'packages/a/node_modules/abbrev': { version: '1.0.4' },
          },
          dependencies: {
            abbrev: { version: '1.1.1' },
            a: { version: 'file:packages/a' },
          },
        }),
      );
      const res = await getNpmLock('package-lock.json');
      expect(res).toEqual({
        lockedVersions: {
          abbrev: '1.1.1',
          'packages/a': '1.0.0',
          'packages/a/node_modules/abbrev': '1.0.4',
        },
        lockfileVersion: 2,
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
