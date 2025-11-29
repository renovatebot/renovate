import { codeBlock } from 'common-tags';
import { findPackages } from 'find-packages';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import {
  collectPackageJsonAsWorkspaceMember,
  getDenoLock,
  getLockedVersion,
  normalizeWorkspace,
} from './post';

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
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
            {
              "dependencies": {
                "hono": "^4.2.1"
              }
            }
          `,
      );
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
});
