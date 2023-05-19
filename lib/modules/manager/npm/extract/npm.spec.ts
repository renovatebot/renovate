import { Fixtures } from '../../../../../test/fixtures';
import { fs } from '../../../../../test/util';
import { extractPackages, getNpmLock } from './npm';

jest.mock('../../../../util/fs');

describe('modules/manager/npm/extract/npm', () => {
  describe('.getNpmLock()', () => {
    it('returns empty if failed to parse', async () => {
      fs.readLocalFile.mockResolvedValueOnce('abcd');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res.lockedVersions)).toHaveLength(0);
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
      fs.readLocalFile.mockResolvedValueOnce(npm9Lock as never);
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

    it('returns empty if no deps', async () => {
      fs.readLocalFile.mockResolvedValueOnce('{}');
      const res = await getNpmLock('package.json');
      expect(Object.keys(res.lockedVersions)).toHaveLength(0);
    });
  });

  describe('.extractPackages', () => {
    it('should parse lockfileVersion 1 without dependencies', () => {
      expect(
        extractPackages({
          name: 'no_dependencies',
          version: '1.0.0',
          lockfileVersion: 1,
        })
      ).toEqual({
        packages: {},
        lockfileVersion: 1,
      });
    });

    it('should not throw if additional property exists', () => {
      const npm9Lock = Fixtures.get('npm9/package-lock.json', '..');
      expect(() =>
        extractPackages({ ...JSON.parse(npm9Lock), additionalProperty: 'test' })
      ).not.toThrow();
    });

    it('should throw if lockfileVersion is invalid', () => {
      const npm9Lock = Fixtures.get('npm9/package-lock.json', '..');
      expect(() => {
        extractPackages({ ...JSON.parse(npm9Lock), lockfileVersion: 4 });
      }).toThrow(
        'Invalid package-lock file. Neither v1, v2 nor v3 schema matched'
      );
    });

    it('should throw if lock file is empty', () => {
      expect(() => {
        extractPackages({});
      }).toThrow(
        'Invalid package-lock file. Neither v1, v2 nor v3 schema matched'
      );
    });

    it('should throw if lockfileVersion 3 without packages property', () => {
      const npm9Lock = Fixtures.get('npm9/package-lock.json', '..');
      expect(() => {
        extractPackages({
          ...JSON.parse(npm9Lock),
          packages: undefined,
          lockfileVersion: 3,
        });
      }).toThrow(
        'Invalid package-lock file. Neither v1, v2 nor v3 schema matched'
      );
    });
  });
});
