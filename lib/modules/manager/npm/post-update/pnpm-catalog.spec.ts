import { codeBlock } from 'common-tags';
import { fs, partial } from '~test/util.ts';
import type { PostUpdateConfig, Upgrade } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import { renamePnpmCatalogReferences } from './pnpm-catalog.ts';
import type { AdditionalPackageFiles } from './types.ts';

vi.mock('../../../../util/fs/index.ts');

const pnpmLockFile = 'pnpm-lock.yaml';

const rootPackageJson = codeBlock`
  {
    "name": "root",
    "devDependencies": {
      "@tsconfig/node24": "catalog:",
      "is-number": "catalog:"
    }
  }
`;

const appPackageJson = codeBlock`
  {
    "name": "app",
    "dependencies": {
      "@tsconfig/node24": "catalog:default"
    },
    "peerDependencies": {
      "@tsconfig/node24": "catalog:"
    }
  }
`;

const toolsPackageJson = codeBlock`
  {
    "name": "tools",
    "devDependencies": {
      "@tsconfig/node24": "catalog:tools",
      "eslint-plugin-vitest": "catalog:tools"
    }
  }
`;

const otherWorkspacePackageJson = codeBlock`
  {
    "name": "other",
    "devDependencies": {
      "@tsconfig/node24": "catalog:"
    }
  }
`;

const files: Record<string, string> = {
  'package.json': rootPackageJson,
  'packages/app/package.json': appPackageJson,
  'packages/tools/package.json': toolsPackageJson,
  'other/package.json': otherWorkspacePackageJson,
};

const packageFiles: AdditionalPackageFiles = {
  npm: [
    {
      packageFile: 'pnpm-workspace.yaml',
      managerData: { pnpmLockFile },
      deps: [
        { depName: '@tsconfig/node24', depType: 'pnpm.catalog.default' },
        { depName: '@tsconfig/node24', depType: 'pnpm.catalog.tools' },
      ],
    },
    {
      packageFile: 'package.json',
      managerData: { pnpmLockFile },
      deps: [
        {
          depName: '@tsconfig/node24',
          depType: 'devDependencies',
          currentValue: 'catalog:',
        },
        {
          depName: 'is-number',
          depType: 'devDependencies',
          currentValue: 'catalog:',
        },
      ],
    },
    {
      packageFile: 'packages/app/package.json',
      managerData: { pnpmLockFile },
      deps: [
        {
          depName: '@tsconfig/node24',
          depType: 'dependencies',
          currentValue: 'catalog:default',
        },
        {
          depName: '@tsconfig/node24',
          depType: 'peerDependencies',
          currentValue: 'catalog:',
        },
      ],
    },
    {
      packageFile: 'packages/tools/package.json',
      managerData: { pnpmLockFile },
      deps: [
        {
          depName: '@tsconfig/node24',
          depType: 'devDependencies',
          currentValue: 'catalog:tools',
        },
        {
          depName: 'eslint-plugin-vitest',
          depType: 'devDependencies',
          currentValue: 'catalog:tools',
        },
      ],
    },
    {
      packageFile: 'other/package.json',
      managerData: { pnpmLockFile: 'other/pnpm-lock.yaml' },
      deps: [
        {
          depName: '@tsconfig/node24',
          depType: 'devDependencies',
          currentValue: 'catalog:',
        },
      ],
    },
    { packageFile: 'no-lock/package.json' },
    { packageFile: 'no-deps/package.json', managerData: { pnpmLockFile } },
  ],
};

function catalogReplacement(
  depType: string,
  overrides: Partial<Upgrade<NpmManagerData>> = {},
): Upgrade<NpmManagerData> {
  return {
    depType,
    depName: '@tsconfig/node24',
    newName: '@tsconfig/node26',
    newValue: '26.0.0',
    updateType: 'replacement',
    packageFile: 'pnpm-workspace.yaml',
    managerData: { pnpmLockFile },
    ...overrides,
  };
}

function getConfig(
  upgrades: Upgrade<NpmManagerData>[],
): PostUpdateConfig<NpmManagerData> {
  return partial<PostUpdateConfig<NpmManagerData>>({
    upgrades,
    updatedPackageFiles: [
      { type: 'addition', path: 'pnpm-workspace.yaml', contents: '' },
    ],
  });
}

describe('modules/manager/npm/post-update/pnpm-catalog', () => {
  beforeEach(() => {
    fs.readLocalFile.mockImplementation((fileName: string): Promise<any> =>
      Promise.resolve(files[fileName] ?? null),
    );
  });

  describe('renamePnpmCatalogReferences()', () => {
    it('renames the references of the default catalog', async () => {
      const res = await renamePnpmCatalogReferences(
        getConfig([catalogReplacement('pnpm.catalog.default')]),
        packageFiles,
      );

      expect(res).toEqual([
        {
          type: 'addition',
          path: 'package.json',
          contents: codeBlock`
            {
              "name": "root",
              "devDependencies": {
                "@tsconfig/node26": "catalog:",
                "is-number": "catalog:"
              }
            }
          `,
        },
        {
          type: 'addition',
          path: 'packages/app/package.json',
          contents: codeBlock`
            {
              "name": "app",
              "dependencies": {
                "@tsconfig/node26": "catalog:default"
              },
              "peerDependencies": {
                "@tsconfig/node26": "catalog:"
              }
            }
          `,
        },
      ]);
      expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        'package.json',
        res[0].type === 'addition' ? res[0].contents : undefined,
      );
      expect(fs.writeLocalFile).toHaveBeenCalledWith(
        'packages/app/package.json',
        res[1].type === 'addition' ? res[1].contents : undefined,
      );
    });

    it('renames the references of a named catalog', async () => {
      const res = await renamePnpmCatalogReferences(
        getConfig([catalogReplacement('pnpm.catalog.tools')]),
        packageFiles,
      );

      expect(res).toEqual([
        {
          type: 'addition',
          path: 'packages/tools/package.json',
          contents: codeBlock`
            {
              "name": "tools",
              "devDependencies": {
                "@tsconfig/node26": "catalog:tools",
                "eslint-plugin-vitest": "catalog:tools"
              }
            }
          `,
        },
      ]);
    });

    it('renames the references of several catalog entries at once', async () => {
      const res = await renamePnpmCatalogReferences(
        getConfig([
          catalogReplacement('pnpm.catalog.tools'),
          catalogReplacement('pnpm.catalog.tools', {
            depName: 'eslint-plugin-vitest',
            newName: '@vitest/eslint-plugin',
          }),
        ]),
        packageFiles,
      );

      expect(res).toEqual([
        {
          type: 'addition',
          path: 'packages/tools/package.json',
          contents: codeBlock`
            {
              "name": "tools",
              "devDependencies": {
                "@tsconfig/node26": "catalog:tools",
                "@vitest/eslint-plugin": "catalog:tools"
              }
            }
          `,
        },
      ]);
    });

    it.each`
      description                                    | upgrade
      ${'a version update of a catalog entry'}       | ${catalogReplacement('pnpm.catalog.default', { newName: undefined, updateType: 'major' })}
      ${'a replacement keeping the name'}            | ${catalogReplacement('pnpm.catalog.default', { newName: '@tsconfig/node24' })}
      ${'a replacement of a package.json dep'}       | ${catalogReplacement('devDependencies', { packageFile: 'package.json' })}
      ${'a catalog entry which was not updated'}     | ${catalogReplacement('pnpm.catalog.default', { packageFile: 'other/pnpm-workspace.yaml' })}
      ${'a catalog entry without package file'}      | ${catalogReplacement('pnpm.catalog.default', { packageFile: undefined })}
      ${'a catalog entry without depName'}           | ${catalogReplacement('pnpm.catalog.default', { depName: undefined })}
      ${'a workspace without pnpm lock file'}        | ${catalogReplacement('pnpm.catalog.default', { managerData: {} })}
      ${'an upgrade without depType or managerData'} | ${{ depName: 'foo', newName: 'bar' }}
    `('does nothing for $description', async ({ upgrade }) => {
      const res = await renamePnpmCatalogReferences(
        getConfig([upgrade]),
        packageFiles,
      );

      expect(res).toEqual([]);
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
    });

    it('does nothing without updated package files', async () => {
      const res = await renamePnpmCatalogReferences(
        partial<PostUpdateConfig<NpmManagerData>>({
          upgrades: [catalogReplacement('pnpm.catalog.default')],
        }),
        packageFiles,
      );

      expect(res).toEqual([]);
    });

    it('does nothing without npm package files', async () => {
      const res = await renamePnpmCatalogReferences(
        getConfig([catalogReplacement('pnpm.catalog.default')]),
        {},
      );

      expect(res).toEqual([]);
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('skips package files which cannot be read or updated', async () => {
      fs.readLocalFile.mockImplementation((fileName: string): Promise<any> =>
        Promise.resolve(
          fileName === 'package.json' ? '{ "name": "root" }' : null,
        ),
      );

      const res = await renamePnpmCatalogReferences(
        getConfig([catalogReplacement('pnpm.catalog.default')]),
        packageFiles,
      );

      expect(res).toEqual([]);
      expect(fs.writeLocalFile).not.toHaveBeenCalled();
    });
  });
});
