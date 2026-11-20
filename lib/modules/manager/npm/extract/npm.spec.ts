import { codeBlock } from 'common-tags';
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

    it('extracts npm 12 lockfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        {
          "name": "npm12",
          "version": "1.0.0",
          "lockfileVersion": 4,
          "requires": true,
          "packages": {
            "": {
              "name": "npm12",
              "version": "1.0.0",
              "dependencies": {
                "escape-string-regexp": "^1.0.5",
                "has-flag": "^3.0.0"
              }
            },
            "node_modules/escape-string-regexp": {
              "version": "1.0.5",
              "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-1.0.5.tgz",
              "integrity": "sha512-vbRorB5FUQWvla16U8R/qgaFIya2qGzwDrNmCZuYKrbdSUMG6I1ZCGQRefkRVhuOkIGVne7BQ35DSfo1qvJqFg=="
            },
            "node_modules/has-flag": {
              "version": "3.0.0",
              "resolved": "https://registry.npmjs.org/has-flag/-/has-flag-3.0.0.tgz",
              "integrity": "sha512-sKJf1+ceQBr4SMkvQnBDNDtf4TXpVhVGateu0t918bl30FnbE2m4vNLX+VWe/dpjlb+HugGYzW7uQXH98HPEYw==",
              "patched": {
                "integrity": "sha512-/MJdQzUWalI3NMluARhqxHnlNSjeqhsdVArG49xZ7Z9lbhRVPr2xeiMJyH0h9xmc9yNhV4ocK6w9SPe/SeShSA==",
                "path": "patches/has-flag@3.0.0.patch"
              }
            }
          }
        }
      `);
      const res = await getNpmLock('package.json');
      expect(res).toEqual({
        lockedVersions: {
          'escape-string-regexp': '1.0.5',
          'has-flag': '3.0.0',
        },
        lockfileVersion: 4,
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
