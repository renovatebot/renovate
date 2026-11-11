import { fs } from '~test/util.ts';
import type { PackageFile } from '../../../types.ts';
import type { NpmManagerData } from '../../types.ts';
import {
  addTransitiveDeps,
  getLockedPackages,
  readLockedPackages,
} from './transitive.ts';

vi.mock('../../../../../util/fs/index.ts');

function lockFile(packages: Record<string, unknown>): string {
  return JSON.stringify({ lockfileVersion: 3, packages });
}

function tarball(name: string, version: string): string {
  const basename = name.split('/').pop()!;
  return `https://registry.npmjs.org/${name}/-/${basename}-${version}.tgz`;
}

describe('modules/manager/npm/extract/post/transitive', () => {
  describe('getLockedPackages()', () => {
    it('returns every package installed under node_modules, once per name and version', () => {
      expect(
        getLockedPackages({
          '': { version: '1.0.0' },
          'node_modules/semver': {
            version: '7.5.1',
            resolved: tarball('semver', '7.5.1'),
          },
          'node_modules/make-dir/node_modules/semver': {
            version: '6.3.0',
            resolved: tarball('semver', '6.3.0'),
          },
          'node_modules/other/node_modules/semver': {
            version: '6.3.0',
            resolved: tarball('semver', '6.3.0'),
          },
          'node_modules/@babel/core': {
            version: '7.0.0',
            resolved: tarball('@babel/core', '7.0.0'),
          },
          'node_modules/braces': { version: '3.0.2' },
        }),
      ).toEqual([
        { name: '@babel/core', packageName: '@babel/core', version: '7.0.0' },
        { name: 'braces', packageName: 'braces', version: '3.0.2' },
        { name: 'semver', packageName: 'semver', version: '6.3.0' },
        { name: 'semver', packageName: 'semver', version: '7.5.1' },
      ]);
    });

    it('uses the published name of an aliased package', () => {
      expect(
        getLockedPackages({
          'node_modules/string-width-cjs': {
            name: 'string-width',
            version: '4.2.3',
            resolved: tarball('string-width', '4.2.3'),
          },
        }),
      ).toEqual([
        {
          name: 'string-width-cjs',
          packageName: 'string-width',
          version: '4.2.3',
        },
      ]);
    });

    it('skips workspace members, links, bundled packages, and non-registry sources', () => {
      expect(
        getLockedPackages({
          'packages/a': { name: 'a', version: '1.0.0' },
          'node_modules/a': { resolved: 'packages/a', link: true },
          'node_modules/bundled': { version: '1.0.0', inBundle: true },
          'node_modules/from-git': {
            version: '1.0.0',
            resolved: 'git+ssh://git@github.com/some/repo.git#abcdef',
          },
          'node_modules/from-tarball': {
            version: '1.0.0',
            resolved: 'https://example.com/downloads/from-tarball.tgz',
          },
          'node_modules/no-version': {},
          'node_modules/invalid-version': { version: 'latest' },
        }),
      ).toEqual([]);
    });
  });

  describe('readLockedPackages()', () => {
    it('returns null for a lock file without `packages`', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({ lockfileVersion: 1, dependencies: {} }),
      );
      await expect(readLockedPackages('package-lock.json')).resolves.toBeNull();
    });

    it('returns null for a lock file which cannot be read', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      await expect(readLockedPackages('package-lock.json')).resolves.toBeNull();
    });
  });

  describe('addTransitiveDeps()', () => {
    it('adds the packages which no package file declares to the package file beside the lock file', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        lockFile({
          '': { workspaces: ['packages/*'] },
          'node_modules/chokidar': { version: '3.6.0' },
          'node_modules/braces': { version: '3.0.2' },
          'node_modules/a': { resolved: 'packages/a', link: true },
          'node_modules/make-dir': { version: '3.1.0' },
          'node_modules/semver': { version: '6.3.0' },
          'node_modules/node-abi/node_modules/semver': { version: '7.5.1' },
          'packages/a': { name: 'a', version: '1.0.0' },
        }),
      );
      const packageFiles: PackageFile<NpmManagerData>[] = [
        {
          packageFile: 'package.json',
          managerData: { npmLock: 'package-lock.json' },
          deps: [{ depName: 'make-dir', currentValue: '3.1.0' }],
        },
        {
          packageFile: 'packages/a/package.json',
          managerData: { npmLock: 'package-lock.json' },
          deps: [{ depName: 'chokidar', currentValue: '3.6.0' }],
        },
        { packageFile: 'other/package.json', deps: [] },
      ];

      await addTransitiveDeps(packageFiles);

      expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
      const transitive = {
        datasource: 'npm',
        depType: 'package-lock.json',
        prettyDepType: 'transitive',
        skipReason: 'lockfile-only',
      };
      expect(packageFiles[0].deps).toEqual([
        { depName: 'make-dir', currentValue: '3.1.0' },
        {
          ...transitive,
          depName: 'braces',
          packageName: 'braces',
          lockedVersion: '3.0.2',
        },
        {
          ...transitive,
          depName: 'semver',
          packageName: 'semver',
          lockedVersion: '6.3.0',
        },
        {
          ...transitive,
          depName: 'semver',
          packageName: 'semver',
          lockedVersion: '7.5.1',
        },
      ]);
      expect(packageFiles[1].deps).toHaveLength(1);
      expect(packageFiles[2].deps).toHaveLength(0);
    });

    it('skips a lock file which no package file sits beside', async () => {
      const packageFiles: PackageFile<NpmManagerData>[] = [
        {
          packageFile: 'packages/a/package.json',
          managerData: { npmLock: 'package-lock.json' },
          deps: [],
        },
      ];

      await addTransitiveDeps(packageFiles);

      expect(fs.readLocalFile).not.toHaveBeenCalled();
      expect(packageFiles[0].deps).toHaveLength(0);
    });

    it('skips a lock file without `packages`', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({ lockfileVersion: 1, dependencies: {} }),
      );
      const packageFiles: PackageFile<NpmManagerData>[] = [
        {
          packageFile: 'package.json',
          managerData: { npmLock: 'package-lock.json' },
          deps: [],
        },
      ];

      await addTransitiveDeps(packageFiles);

      expect(packageFiles[0].deps).toHaveLength(0);
    });
  });
});
