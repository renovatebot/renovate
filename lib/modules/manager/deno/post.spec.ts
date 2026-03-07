import { codeBlock } from 'common-tags';
import { findPackages } from 'find-packages';
import { fs } from '../../../../test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type { PackageDependency } from '../types.ts';
import * as compat from './compat.ts';
import {
  collectPackageJsonAsWorkspaceMember,
  getDenoLock,
  getLockedVersion,
  normalizeWorkspace,
} from './post.ts';
import type { DenoManagerData } from './types.ts';

vi.mock('../../../util/fs');
// used in detectNodeCompatWorkspaces()
vi.mock('find-packages', () => ({
  findPackages: vi.fn(),
}));

describe('modules/manager/deno/post', () => {
  describe('getDenoLock()', () => {
    it('empty lock file', async () => {
      fs.readLocalFile.mockResolvedValueOnce(JSON.stringify({}));
      const result = await getDenoLock('deno.lock');
      expect(result).toMatchObject({});
    });

    it('not supported version', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: '4',
          specifiers: {
            'jsr:@scope/name@1': '1.0.0',
          },
        }),
      );
      const result = await getDenoLock('deno.lock');
      expect(result).toMatchObject({});
    });

    it('redirectVersions', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: '5',
          redirects: {
            'https://deno.land/dep1':
              'https://deno.land/dep1@0.223.0/fs/mod.ts',
          },
        }),
      );
      const result = await getDenoLock('deno.lock');
      expect(result).toMatchObject({
        lockfileVersion: 5,
        redirectVersions: {
          'https://deno.land/dep1': 'https://deno.land/dep1@0.223.0/fs/mod.ts',
        },
      });
    });

    it('remoteVersions', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: '5',
          remote: {
            'https://deno.land/dep1@0.223.0/fs/mod.ts': 'integrity',
          },
        }),
      );
      const result = await getDenoLock('deno.lock');
      expect(result).toMatchObject({
        lockfileVersion: 5,
        remoteVersions: new Set<string>([
          'https://deno.land/dep1@0.223.0/fs/mod.ts',
        ]),
      });
    });

    it('complex specifiers', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: '5',
          specifiers: {
            'jsr:@scope/name@*':
              '7.1.3_jsr:@scope+name@4.0.3_@types+pkgname@1.0.1',
          },
        }),
      );
      const result = await getDenoLock('deno.lock');
      expect(result).toMatchObject({
        lockfileVersion: 5,
        lockedVersions: {
          'jsr:@scope/name@*': '7.1.3',
        },
      });
    });
  });

  describe('getLockedVersion()', () => {
    it('empty lock file', () => {
      const result = getLockedVersion({}, {});
      expect(result).toBeNull();
    });

    it('deno datasource remoteVersions', () => {
      const result = getLockedVersion(
        {
          datasource: 'deno',
          currentRawValue: 'https://deno.land/dep1@0.223.0/fs/mod.ts',
          currentValue: '0.223.0',
          depName: 'https://deno.land/dep1',
        },
        {
          remoteVersions: new Set<string>([
            'https://deno.land/dep1@0.223.0/fs/mod.ts',
          ]),
        },
      );
      expect(result).toBe('0.223.0');
    });

    it('deno datasource redirects', () => {
      const result = getLockedVersion(
        {
          datasource: 'deno',
          currentRawValue: 'https://deno.land/dep1',
          depName: 'https://deno.land/dep1',
        },
        {
          redirectVersions: {
            'https://deno.land/dep1':
              'https://deno.land/dep1@0.223.0/fs/mod.ts',
          },
        },
      );
      expect(result).toBe('0.223.0');
    });

    it('get exact lockedVersion', () => {
      const result = getLockedVersion(
        {
          datasource: 'jsr',
          currentRawValue: 'jsr:@scope/name@1.2.3',
          depName: '@scope/name',
        },
        {
          lockedVersions: {
            'jsr:@scope/name@1.2.3': '1.2.3',
          },
        },
      );
      expect(result).toBe('1.2.3');
    });

    it('get latest lockedVersion', () => {
      const result = getLockedVersion(
        {
          datasource: 'jsr',
          currentRawValue: 'jsr:@scope/name',
          depName: '@scope/name',
        },
        {
          lockedVersions: {
            'jsr:@scope/name@*': '1.2.3',
          },
        },
      );
      expect(result).toBe('1.2.3');
    });

    it('get intersects lockedVersion', () => {
      const result = getLockedVersion(
        {
          datasource: 'jsr',
          currentValue: '^1.0.0',
          currentRawValue: 'jsr:@scope/name@^1.0.0',
          depName: '@scope/name',
        },
        {
          lockedVersions: {
            'jsr:@scope/name@1': '1.8.5',
          },
        },
      );
      expect(result).toBe('1.8.5');
    });

    it('invalid lock file content', () => {
      const result = getLockedVersion(
        {
          datasource: 'npm',
          currentValue: '1.0.0',
          depName: 'npm:@scope/name',
        },
        {
          lockfileVersion: 5,
          lockedVersions: {
            INVALID_KEY: '1.0.0',
          },
        },
      );
      expect(result).toBeNull();
    });
  });

  describe('collectPackageJsonAsWorkspaceMember()', () => {
    it('should collect package.json files as deno workspace members', async () => {
      GlobalConfig.set({ localDir: '' });
      vi.mocked(findPackages).mockResolvedValue([
        {
          dir: 'node',
          manifest: {},
          writeProjectManifest: Promise.resolve,
        },
      ]);
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
            {
              "dependencies": {
                "hono": "^4.2.1"
              }
            }
          `);
      const packageFiles = [
        {
          deps: [],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['node'],
          },
          packageFile: 'deno.json',
        },
      ];

      await collectPackageJsonAsWorkspaceMember(packageFiles);
      expect(packageFiles).toStrictEqual([
        {
          deps: [],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['node'],
          },
          packageFile: 'deno.json',
        },
        {
          deps: [
            {
              currentValue: '^4.2.1',
              datasource: 'npm',
              depName: 'hono',
              depType: 'dependencies',
              prettyDepType: 'dependency',
            },
          ],
          extractedConstraints: {},
          lockFiles: ['deno.lock'],
          managerData: {
            packageName: undefined,
            workspaces: undefined,
          },
          packageFile: 'node/package.json',
          packageFileVersion: undefined,
        },
      ]);
    });

    it('should handle when detectNodeCompatWorkspaces returns null', async () => {
      GlobalConfig.set({ localDir: '' });
      vi.spyOn(compat, 'detectNodeCompatWorkspaces').mockResolvedValue(null);
      const packageFiles = [
        {
          deps: [],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['node'],
          },
          packageFile: 'deno.json',
        },
      ];

      await collectPackageJsonAsWorkspaceMember(packageFiles);
      expect(packageFiles).toStrictEqual([
        {
          deps: [],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['node'],
          },
          packageFile: 'deno.json',
        },
      ]);
    });

    it('should handle when extractDenoCompatiblePackageJson returns null', async () => {
      GlobalConfig.set({ localDir: '' });
      vi.spyOn(compat, 'detectNodeCompatWorkspaces').mockRestore();
      vi.mocked(findPackages).mockResolvedValue([
        {
          dir: 'node',
          manifest: {},
          writeProjectManifest: Promise.resolve,
        },
      ]);
      fs.readLocalFile.mockResolvedValueOnce(null);
      const packageFiles = [
        {
          deps: [],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['node'],
          },
          packageFile: 'deno.json',
        },
      ];

      await collectPackageJsonAsWorkspaceMember(packageFiles);
      expect(packageFiles).toStrictEqual([
        {
          deps: [],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['node'],
          },
          packageFile: 'deno.json',
        },
      ]);
    });
  });

  describe('normalizeWorkspace()', () => {
    it('nested workspace is invalid', () => {
      const packageFiles = [
        {
          deps: [
            {
              currentValue: '^3.4.6',
              datasource: 'jsr',
              depName: '@scope/dep1',
            },
          ],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['./sub/*'],
          },
          packageFile: 'deno.json',
        },
        {
          deps: [
            {
              currentValue: '1.2.4',
              datasource: 'npm',
              depName: 'dep2',
            },
          ],
          managerData: {
            workspaces: ['nested'],
          },
          lockFiles: [],
          packageFile: 'sub/deno.json',
        },
        {
          deps: [
            {
              currentValue: '^1.0.0',
              datasource: 'jsr',
              depName: '@scope/dep3',
            },
          ],
          lockFiles: [],
          managerData: {
            packageName: 'nested',
          },
          packageFile: 'sub/nested/deno.json',
        },
      ];

      normalizeWorkspace(packageFiles);
      expect(packageFiles).toStrictEqual([
        {
          deps: [
            {
              currentValue: '^3.4.6',
              datasource: 'jsr',
              depName: '@scope/dep1',
            },
          ],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['./sub/*'],
          },
          packageFile: 'deno.json',
        },
        {
          deps: [
            {
              currentValue: '1.2.4',
              datasource: 'npm',
              depName: 'dep2',
            },
          ],
          managerData: {},
          lockFiles: ['deno.lock'],
          packageFile: 'sub/deno.json',
        },
        {
          deps: [
            {
              currentValue: '^1.0.0',
              datasource: 'jsr',
              depName: '@scope/dep3',
            },
          ],
          lockFiles: ['deno.lock'],
          managerData: {
            packageName: 'nested',
          },
          packageFile: 'sub/nested/deno.json',
        },
      ]);
    });
  });

  describe('postExtract()', () => {
    it('should handle lock file reading failure', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const result = await getDenoLock('deno.lock');
      expect(result).toMatchObject({ lockedVersions: {} });
    });

    it('should handle invalid lock file JSON', async () => {
      fs.readLocalFile.mockResolvedValueOnce('invalid json');
      const result = await getDenoLock('deno.lock');
      expect(result).toMatchObject({ lockedVersions: {} });
    });

    it('should handle deno datasource with no remoteVersions match', () => {
      const result = getLockedVersion(
        {
          datasource: 'deno',
          currentRawValue: 'https://deno.land/dep1@0.223.0/fs/mod.ts',
          currentValue: '0.223.0',
          depName: 'https://deno.land/dep1',
        },
        {
          remoteVersions: new Set<string>([
            'https://deno.land/other@0.1.0/fs/mod.ts',
          ]),
        },
      );
      expect(result).toBeNull();
    });

    it('should handle deno datasource with no depName', () => {
      const result = getLockedVersion(
        {
          datasource: 'deno',
          currentRawValue: 'https://deno.land/dep1',
        },
        {
          redirectVersions: {},
        },
      );
      expect(result).toBeNull();
    });

    it('should handle jsr datasource with no lockedVersions', () => {
      const result = getLockedVersion(
        {
          datasource: 'jsr',
          currentRawValue: 'jsr:@scope/name@1.2.3',
          depName: '@scope/name',
        },
        {
          lockedVersions: undefined,
        },
      );
      expect(result).toBeNull();
    });

    it('should apply locked versions from lock files', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: '5',
          specifiers: {
            'jsr:@scope/name@1.2.3': '1.2.3',
          },
        }),
      );
      const packageFiles = [
        {
          deps: [
            {
              datasource: 'jsr',
              currentRawValue: 'jsr:@scope/name@1.2.3',
              depName: '@scope/name',
            } as PackageDependency<DenoManagerData>,
          ],
          lockFiles: ['deno.lock'],
          packageFile: 'deno.json',
        },
      ];

      const { postExtract } = await import('./post.ts');
      await postExtract(packageFiles);
      expect(
        (
          packageFiles[0].deps[0] as PackageDependency<DenoManagerData> & {
            lockedVersion?: string;
          }
        ).lockedVersion,
      ).toBe('1.2.3');
    });

    it('should handle lock file with no lockFiles', async () => {
      const packageFiles = [
        {
          deps: [
            {
              datasource: 'jsr',
              currentRawValue: 'jsr:@scope/name@1.2.3',
              depName: '@scope/name',
            } as PackageDependency<DenoManagerData>,
          ],
          lockFiles: [],
          packageFile: 'deno.json',
        },
      ];

      const { postExtract } = await import('./post.ts');
      await postExtract(packageFiles);
      expect(
        (
          packageFiles[0].deps[0] as PackageDependency<DenoManagerData> & {
            lockedVersion?: string;
          }
        ).lockedVersion,
      ).toBeUndefined();
    });

    it('should use lock file cache for multiple packages', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: '5',
          specifiers: {
            'jsr:@scope/name@1.2.3': '1.2.3',
          },
        }),
      );
      const packageFiles = [
        {
          deps: [
            {
              datasource: 'jsr',
              currentRawValue: 'jsr:@scope/name@1.2.3',
              depName: '@scope/name',
            } as PackageDependency<DenoManagerData>,
          ],
          lockFiles: ['deno.lock'],
          packageFile: 'deno.json',
        },
        {
          deps: [
            {
              datasource: 'jsr',
              currentRawValue: 'jsr:@scope/name@1.2.3',
              depName: '@scope/name',
            } as PackageDependency<DenoManagerData>,
          ],
          lockFiles: ['deno.lock'],
          packageFile: 'sub/deno.json',
        },
      ];

      const { postExtract } = await import('./post.ts');
      await postExtract(packageFiles);
      expect(
        (
          packageFiles[0].deps[0] as PackageDependency<DenoManagerData> & {
            lockedVersion?: string;
          }
        ).lockedVersion,
      ).toBe('1.2.3');
      expect(
        (
          packageFiles[1].deps[0] as PackageDependency<DenoManagerData> & {
            lockedVersion?: string;
          }
        ).lockedVersion,
      ).toBe('1.2.3');
      expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    });

    it('should handle deno datasource with empty redirectVersions', () => {
      const result = getLockedVersion(
        {
          datasource: 'deno',
          currentRawValue: 'https://deno.land/dep1',
          depName: 'https://deno.land/dep1',
        },
        {
          redirectVersions: {},
        },
      );
      expect(result).toBeNull();
    });

    it('should handle deno datasource with currentValue and depName for redirects', () => {
      const result = getLockedVersion(
        {
          datasource: 'deno',
          currentValue: '0.223.0',
          depName: 'https://deno.land/dep1',
        },
        {
          redirectVersions: {
            'https://deno.land/dep1@0.223.0':
              'https://deno.land/dep1@0.223.0/fs/mod.ts',
          },
        },
      );
      expect(result).toBe('0.223.0');
    });

    it('should handle dep without lockedVersion match', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: '5',
          specifiers: {
            'jsr:@scope/other@1.2.3': '1.2.3',
          },
        }),
      );
      const packageFiles = [
        {
          deps: [
            {
              datasource: 'jsr',
              currentRawValue: 'jsr:@scope/name@1.2.3',
              depName: '@scope/name',
            } as PackageDependency<DenoManagerData>,
          ],
          lockFiles: ['deno.lock'],
          packageFile: 'deno.json',
        },
      ];

      const { postExtract } = await import('./post.ts');
      await postExtract(packageFiles);
      expect(
        (
          packageFiles[0].deps[0] as PackageDependency<DenoManagerData> & {
            lockedVersion?: string;
          }
        ).lockedVersion,
      ).toBeUndefined();
    });
  });

  describe('normalizeWorkspace() - additional cases', () => {
    it('workspace member not matching any workspace pattern', () => {
      const packageFiles = [
        {
          deps: [],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['packages/*'],
          },
          packageFile: 'deno.json',
        },
        {
          deps: [],
          lockFiles: [],
          managerData: {},
          packageFile: 'other/deno.json',
        },
      ];

      normalizeWorkspace(packageFiles);
      expect(packageFiles[1].lockFiles).toEqual([]);
    });

    it('nested workspace removal with packageMap.get returning undefined', () => {
      const packageFiles = [
        {
          deps: [],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['./sub/*'],
          },
          packageFile: 'deno.json',
        },
        {
          deps: [],
          managerData: {
            workspaces: ['nested'],
          },
          lockFiles: [],
          packageFile: 'sub/deno.json',
        },
      ];

      normalizeWorkspace(packageFiles);
      // Verify that workspace is removed from nested package
      expect(packageFiles[1].managerData?.workspaces).toBeUndefined();
    });

    it('invalidPackageFiles entry not found in packageMap', () => {
      const packageFiles = [
        {
          deps: [],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: ['./sub/*'],
          },
          packageFile: 'deno.json',
        },
        {
          deps: [],
          managerData: {
            workspaces: ['nested'],
          },
          lockFiles: [],
          packageFile: 'sub/deno.json',
        },
      ];

      // Create a scenario where packageMap entry might not exist
      // This tests the `if (pkg)` branch
      normalizeWorkspace(packageFiles);
      // Should handle gracefully without error
      expect(packageFiles).toHaveLength(2);
    });
  });
});
