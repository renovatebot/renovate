import { codeBlock } from 'common-tags';
import { fs, partial } from '~test/util.ts';
import type { NpmManagerData } from '../npm/types.ts';
import type { NpmrcPackageFile, PackageDependency } from '../types.ts';
import { setBunLockedVersions } from './locked-versions.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/bun/locked-versions', () => {
  function packageFile(
    packageFileName: string,
    deps: PackageDependency<NpmManagerData>[],
    packageJsonName?: string,
    lockFile = 'bun.lock',
  ): NpmrcPackageFile<NpmManagerData> {
    return partial({
      packageFile: packageFileName,
      lockFiles: [lockFile],
      managerData: { packageJsonName },
      deps,
    });
  }

  const bunLock = codeBlock`
    {
      // Bun's text lockfile is JSONC.
      "lockfileVersion": 2,
      "workspaces": {
        "": {
          "name": "@demo/root",
          "dependencies": {
            "root": "^1.0.0",
            "@scope/pkg": "^2.0.0",
            "alias": "npm:@scope/real@^3.0.0",
          },
        },
        "packages/app": {
          "name": "@demo/app",
          "dependencies": {
            "root": "4.0.0",
            "hoisted": "^5.0.0",
            "@scope/pkg": "^2.0.0",
          },
        },
      },
      "packages": {
        "root": ["root@1.2.3", "", {}],
        "@scope/pkg": ["@scope/pkg@2.3.4", "", {}],
        "alias": ["@scope/real@3.4.5", "", {}],
        "hoisted": ["hoisted@5.6.7", "", {}],
        "transitive": ["transitive@6.7.8", "", {}],
        "@demo/app/root": ["root@4.0.0", "", {}],
        "@demo/app/@scope/pkg": ["@scope/pkg@2.4.0", "", {}],
      },
    }
  `;

  it('sets root locked versions for direct dependencies, scoped packages, and aliases', async () => {
    fs.readLocalFile.mockResolvedValueOnce(bunLock);
    const packageFiles = [
      packageFile(
        'package.json',
        [
          {
            datasource: 'npm',
            depName: 'root',
            depType: 'dependencies',
          },
          {
            datasource: 'npm',
            depName: '@scope/pkg',
            depType: 'dependencies',
          },
          {
            datasource: 'npm',
            depName: 'alias',
            packageName: '@scope/real',
            depType: 'dependencies',
          },
        ],
        '@demo/root',
      ),
    ];

    await setBunLockedVersions(packageFiles);

    expect(packageFiles[0].deps).toEqual([
      expect.objectContaining({ depName: 'root', lockedVersion: '1.2.3' }),
      expect.objectContaining({
        depName: '@scope/pkg',
        lockedVersion: '2.3.4',
      }),
      expect.objectContaining({ depName: 'alias', lockedVersion: '3.4.5' }),
    ]);
  });

  it('prefers workspace-specific versions and falls back to hoisted packages', async () => {
    fs.readLocalFile.mockResolvedValueOnce(bunLock);
    const packageFiles = [
      packageFile(
        'packages/app/package.json',
        [
          {
            datasource: 'npm',
            depName: 'root',
            depType: 'dependencies',
          },
          {
            datasource: 'npm',
            depName: 'hoisted',
            depType: 'dependencies',
          },
          {
            datasource: 'npm',
            depName: '@scope/pkg',
            depType: 'dependencies',
          },
        ],
        '@demo/app',
      ),
    ];

    await setBunLockedVersions(packageFiles);

    expect(packageFiles[0].deps).toEqual([
      expect.objectContaining({ depName: 'root', lockedVersion: '4.0.0' }),
      expect.objectContaining({ depName: 'hoisted', lockedVersion: '5.6.7' }),
      expect.objectContaining({
        depName: '@scope/pkg',
        lockedVersion: '2.4.0',
      }),
    ]);
  });

  it('does not use a same-named package for an unresolved optional dependency', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      codeBlock`
        {
          "lockfileVersion": 2,
          "workspaces": {
            "": {
              "name": "root",
              "dependencies": { "express": "5.1.0" },
              "optionalDependencies": { "debug": "99.0.0" },
              "unresolved": ["debug"],
            },
          },
          "packages": {
            "express": ["express@5.1.0"],
            "debug": ["debug@4.4.3"],
          },
        }
      `,
    );
    const packageFiles = [
      packageFile('package.json', [
        {
          datasource: 'npm',
          depName: 'debug',
          depType: 'optionalDependencies',
        },
      ]),
    ];

    await setBunLockedVersions(packageFiles);

    expect(packageFiles[0].deps[0].lockedVersion).toBeUndefined();
  });

  it('sets only npm direct dependency types with valid semver tuples', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      codeBlock`
        {
          "lockfileVersion": 2,
          "workspaces": {
            "": {
              "dependencies": {
                "dependency": "^1.0.0",
                "workspace": "workspace:packages/workspace",
                "mismatch": "^5.0.0",
                "invalid": "latest",
                "malformed": "^1.0.0",
                "missing": "^1.0.0",
              },
              "devDependencies": { "dev": "^2.0.0" },
              "optionalDependencies": { "optional": "^3.0.0" },
              "peerDependencies": { "peer": "^4.0.0" },
              "unresolved": [],
            },
          },
          "packages": {
            "dependency": ["dependency@1.0.0"],
            "dev": ["dev@2.0.0"],
            "optional": ["optional@3.0.0"],
            "peer": ["peer@4.0.0"],
            "workspace": ["workspace@workspace:packages/workspace"],
            "mismatch": ["other@5.0.0"],
            "invalid": ["invalid@not-semver"],
            "malformed": {},
          },
        }
      `,
    );
    const packageFiles = [
      packageFile('package.json', [
        { datasource: 'npm', depName: 'dependency', depType: 'dependencies' },
        { datasource: 'npm', depName: 'dev', depType: 'devDependencies' },
        {
          datasource: 'npm',
          depName: 'optional',
          depType: 'optionalDependencies',
        },
        { datasource: 'npm', depName: 'peer', depType: 'peerDependencies' },
        { datasource: 'npm', depName: 'workspace', depType: 'dependencies' },
        { datasource: 'npm', depName: 'mismatch', depType: 'dependencies' },
        { datasource: 'npm', depName: 'invalid', depType: 'dependencies' },
        { datasource: 'npm', depName: 'malformed', depType: 'dependencies' },
        { datasource: 'npm', depName: 'missing', depType: 'dependencies' },
        { datasource: 'npm', depName: 'engine', depType: 'engines' },
        {
          datasource: 'github-tags',
          depName: 'other',
          depType: 'dependencies',
        },
        { datasource: 'npm', depType: 'dependencies' },
      ]),
    ];

    await setBunLockedVersions(packageFiles);

    expect(packageFiles[0].deps.map((dep) => dep.lockedVersion)).toEqual([
      '1.0.0',
      '2.0.0',
      '3.0.0',
      '4.0.0',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('does not use stale package-tree entries for new direct dependencies', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      codeBlock`
        {
          "lockfileVersion": 2,
          "workspaces": {
            "": {
              "name": "root",
              "dependencies": { "present": "^1.0.0" },
            },
            "packages/app": {
              "name": "@demo/app",
              "dependencies": { "present": "^1.0.0" },
            },
          },
          "packages": {
            "present": ["present@1.2.3"],
            "stale": ["stale@9.9.9"],
            "@demo/app/stale": ["stale@8.8.8"],
          },
        }
      `,
    );
    const packageFiles = [
      packageFile(
        'package.json',
        [{ datasource: 'npm', depName: 'stale', depType: 'dependencies' }],
        'root',
      ),
      packageFile(
        'packages/app/package.json',
        [{ datasource: 'npm', depName: 'stale', depType: 'dependencies' }],
        '@demo/app',
      ),
    ];

    await setBunLockedVersions(packageFiles);

    expect(packageFiles[0].deps[0].lockedVersion).toBeUndefined();
    expect(packageFiles[1].deps[0].lockedVersion).toBeUndefined();
  });

  it('ignores package files without a matching Bun workspace record', async () => {
    fs.readLocalFile.mockResolvedValueOnce(bunLock);
    const packageFiles = [
      packageFile(
        'packages/missing/package.json',
        [{ datasource: 'npm', depName: 'root', depType: 'dependencies' }],
        '@demo/missing',
      ),
    ];

    await setBunLockedVersions(packageFiles);

    expect(packageFiles[0].deps[0].lockedVersion).toBeUndefined();
  });

  it('rejects a malformed unresolved list', async () => {
    fs.readLocalFile.mockResolvedValueOnce(
      JSON.stringify({
        lockfileVersion: 2,
        workspaces: {
          '': {
            dependencies: { pkg: '^1.0.0' },
            unresolved: 'pkg',
          },
        },
        packages: { pkg: ['pkg@1.2.3'] },
      }),
    );
    const packageFiles = [
      packageFile('package.json', [
        { datasource: 'npm', depName: 'pkg', depType: 'dependencies' },
        { datasource: 'npm', depName: 'pkg' },
      ]),
    ];

    await setBunLockedVersions(packageFiles);

    expect(packageFiles[0].deps).not.toSatisfyAny(
      (dep) => dep.lockedVersion !== undefined,
    );
  });

  it.each([0, 1, 2, 3])(
    'supports Bun lockfile version %s',
    async (lockfileVersion) => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          lockfileVersion,
          workspaces: { '': { dependencies: { pkg: '^1.0.0' } } },
          packages: { pkg: ['pkg@1.2.3'] },
        }),
      );
      const packageFiles = [
        packageFile('package.json', [
          { datasource: 'npm', depName: 'pkg', depType: 'dependencies' },
        ]),
      ];

      await setBunLockedVersions(packageFiles);

      expect(packageFiles[0].deps[0].lockedVersion).toBe('1.2.3');
    },
  );

  it.each([
    'null',
    '{}',
    '{ "lockfileVersion": 4, "workspaces": {}, "packages": {} }',
    '{ "lockfileVersion": 2, "packages": {} }',
  ])('ignores an unsupported Bun lock structure: %s', async (content) => {
    fs.readLocalFile.mockResolvedValueOnce(content);
    const packageFiles = [
      packageFile('package.json', [
        { datasource: 'npm', depName: 'pkg', depType: 'dependencies' },
      ]),
    ];

    await setBunLockedVersions(packageFiles);

    expect(packageFiles[0].deps[0].lockedVersion).toBeUndefined();
  });

  it('ignores unreadable, malformed, and binary lockfiles', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null).mockResolvedValueOnce('{');
    const unreadable = packageFile('package.json', [
      { datasource: 'npm', depName: 'pkg', depType: 'dependencies' },
    ]);
    const malformed = packageFile(
      'nested/package.json',
      [{ datasource: 'npm', depName: 'pkg', depType: 'dependencies' }],
      undefined,
      'nested/bun.lock',
    );
    const binary = packageFile(
      'binary/package.json',
      [{ datasource: 'npm', depName: 'pkg', depType: 'dependencies' }],
      undefined,
      'binary/bun.lockb',
    );

    await setBunLockedVersions([unreadable, malformed, binary]);

    expect(unreadable.deps[0].lockedVersion).toBeUndefined();
    expect(malformed.deps[0].lockedVersion).toBeUndefined();
    expect(binary.deps[0].lockedVersion).toBeUndefined();
  });

  it('reads a shared lockfile once for root and workspace package files', async () => {
    fs.readLocalFile.mockResolvedValueOnce(bunLock);
    const packageFiles = [
      packageFile(
        'package.json',
        [{ datasource: 'npm', depName: 'root', depType: 'dependencies' }],
        '@demo/root',
      ),
      packageFile(
        'packages/app/package.json',
        [{ datasource: 'npm', depName: 'root', depType: 'dependencies' }],
        '@demo/app',
      ),
    ];

    await setBunLockedVersions(packageFiles);

    expect(fs.readLocalFile).toHaveBeenCalledOnce();
  });
});
