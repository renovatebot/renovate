vi.mock('fs-extra', async () =>
  (
    await vi.importActual<typeof import('~test/fixtures')>('~test/fixtures')
  ).fsExtra(),
);

import { GlobalConfig } from '../../../config/global';
import type { LockFile } from './types';
import { composeLockFile, loadPackageJson, parseLockFile } from './utils';
import { Fixtures } from '~test/fixtures';

describe('modules/manager/npm/utils', () => {
  describe('parseLockFile', () => {
    it('parses lockfile string into an object', () => {
      const lockFile = Fixtures.get('lockfile-parsing/package-lock.json');
      const parseLockFileResult = parseLockFile(lockFile);
      expect(parseLockFileResult).toStrictEqual({
        detectedIndent: '  ',
        lockFileParsed: {
          lockfileVersion: 2,
          name: 'lockfile-parsing',
          packages: {
            '': {
              license: 'ISC',
              name: 'lockfile-parsing',
              version: '1.0.0',
            },
          },
          requires: true,
          version: '1.0.0',
        },
      });
    });

    it('can deal with invalid lockfiles', () => {
      const lockFile = '';
      const parseLockFileResult = parseLockFile(lockFile);
      expect(parseLockFileResult).toStrictEqual({
        detectedIndent: '  ',
        lockFileParsed: undefined,
      });
    });
  });

  describe('composeLockFile', () => {
    it('composes lockfile string out of an object', () => {
      const lockFile: LockFile = {
        lockfileVersion: 2,
        name: 'lockfile-parsing',
        packages: {
          '': {
            license: 'ISC',
            name: 'lockfile-parsing',
            version: '1.0.0',
          },
        },
        requires: true,
        version: '1.0.0',
      };
      const lockFileComposed = composeLockFile(lockFile, '  ');
      expect(lockFileComposed).toMatchSnapshot();
    });

    it('adds trailing newline to match npms behavior and avoid diffs', () => {
      const lockFile = Fixtures.get('lockfile-parsing/package-lock.json');
      const { detectedIndent, lockFileParsed } = parseLockFile(lockFile);
      // TODO #22198
      const lockFileComposed = composeLockFile(lockFileParsed!, detectedIndent);
      expect(lockFileComposed).toBe(lockFile);
    });
  });

  describe('loadPackageJson', () => {
    beforeEach(() => {
      Fixtures.reset();
      GlobalConfig.set({ localDir: '/', cacheDir: '/tmp/cache' });
    });

    it('loads and parses package.json correctly', async () => {
      Fixtures.mock({
        '/repo/package.json': JSON.stringify({
          dependencies: { leftpad: '1.0.0' },
          engines: { node: '>=16.0.0' },
          volta: { yarn: '1.22.19' },
          packageManager: 'npm@8.5.1',
        }),
      });

      const pkg = await loadPackageJson('/repo');
      expect(pkg).toStrictEqual({
        dependencies: { leftpad: '1.0.0' },
        engines: { node: '>=16.0.0' },
        volta: { yarn: '1.22.19' },
        packageManager: { name: 'npm', version: '8.5.1' },
      });
    });

    it('returns empty object when package.json is missing', async () => {
      const pkg = await loadPackageJson('/missing');
      expect(pkg).toStrictEqual({});
    });

    it('returns empty object when package.json is invalid', async () => {
      Fixtures.mock({ '/bad/package.json': '{ invalid json' });
      const pkg = await loadPackageJson('/bad');
      expect(pkg).toStrictEqual({});
    });
  });
});
