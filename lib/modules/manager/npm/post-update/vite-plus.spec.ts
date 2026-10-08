import { inspect } from 'node:util';
import { logger, partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import { ExternalHostError } from '../../../../types/errors/external-host-error.ts';
import { ExecError } from '../../../../util/exec/exec-error.ts';
import { exec } from '../../../../util/exec/index.ts';
import { getFile } from '../../../../util/git/index.ts';
import type { FileAddition } from '../../../../util/git/types.ts';
import type { PostUpdateConfig } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import type { AdditionalPackageFiles } from './types.ts';
import {
  hasReconciledVitePlusTargets,
  reconcileVitePlusVersions,
} from './vite-plus.ts';

vi.mock('../../../../util/exec/index.ts');
vi.mock('../../../../util/git/index.ts');

const execMock = vi.mocked(exec);
const getFileMock = vi.mocked(getFile);

function packageJson(vitePlus: string, coverage: string): string {
  return `${JSON.stringify(
    {
      devDependencies: {
        'vite-plus': vitePlus,
        '@vitest/coverage-v8': coverage,
      },
    },
    null,
    2,
  )}\n`;
}

function aliasedPackageJson(vitePlus: string, vite: string): string {
  return `${JSON.stringify({
    devDependencies: { 'vite-plus': vitePlus, vite },
  })}\n`;
}

function aliasedVitePlusPackageJson(
  vitePlus: string,
  coverage: string,
): string {
  return `${JSON.stringify({
    devDependencies: {
      vp: `npm:vite-plus@${vitePlus}`,
      '@vitest/coverage-v8': coverage,
    },
  })}\n`;
}

function packageFiles(): AdditionalPackageFiles {
  return {
    npm: [
      {
        packageFile: 'package.json',
        managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
        deps: [
          {
            depName: 'vite-plus',
            currentVersion: '0.2.0',
            lockedVersion: '0.2.0',
          },
          {
            depName: '@vitest/coverage-v8',
            currentVersion: '4.0.0',
            lockedVersion: '4.0.0',
          },
        ],
      },
    ],
  };
}

function config(
  updatedContents: string,
  depName = 'vite-plus',
  newVersion = '0.3.0',
): PostUpdateConfig<NpmManagerData> {
  return partial<PostUpdateConfig<NpmManagerData>>({
    postUpdateOptions: ['vitePlusSyncVersions'],
    upgrades: [
      {
        manager: 'npm',
        depName,
        depType: 'devDependencies',
        packageFile: 'package.json',
        currentVersion: depName === 'vite-plus' ? '0.2.0' : '4.0.0',
        currentValue: depName === 'vite-plus' ? '0.2.0' : '4.0.0',
        newVersion,
        newValue: newVersion,
        managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
      },
    ],
    updatedPackageFiles: [
      { type: 'addition', path: 'package.json', contents: updatedContents },
    ],
  });
}

function additionContents(file: FileAddition | undefined): string | undefined {
  return file?.contents?.toString();
}

function mockFiles(files: Record<string, string | null>): void {
  getFileMock.mockImplementation((path) =>
    Promise.resolve(files[path] ?? null),
  );
}

function mockPlan(transform: (request: any) => unknown): void {
  execMock.mockImplementation((_commands, options) =>
    Promise.resolve({
      stdout: JSON.stringify(transform(JSON.parse(options!.input as string))),
      stderr: '',
    }),
  );
}

function validPlan(
  request: any,
  after: string,
  path = 'package.json',
): unknown {
  const manifest = request.manifests.find(
    (candidate: any) => candidate.path === path,
  );
  return {
    schemaVersion: 1,
    tool: { name: 'vite-plus', version: '0.3.0' },
    workspace: '.',
    replacements: [
      {
        path,
        kind: manifest.kind,
        before: manifest.contents,
        after,
      },
    ],
  };
}

describe('modules/manager/npm/post-update/vite-plus', () => {
  beforeEach(() => {
    GlobalConfig.set({ binarySource: 'docker' });
  });

  describe('hasReconciledVitePlusTargets', () => {
    const branchName = 'renovate/vite-plus';

    it.each`
      packageFile              | depType                   | contents
      ${'package.json'}        | ${'devDependencies'}      | ${JSON.stringify({ devDependencies: { '@vitest/coverage-v8': '4.1.11' } })}
      ${'custom-package.json'} | ${'devDependencies'}      | ${JSON.stringify({ devDependencies: { '@vitest/coverage-v8': '4.1.11' } })}
      ${'package.json'}        | ${'devDependencies'}      | ${JSON.stringify({ devDependencies: { coverage: 'npm:@vitest/coverage-v8@4.1.11' } })}
      ${'package.json'}        | ${'catalog'}              | ${JSON.stringify({ catalog: { '@vitest/coverage-v8': '4.1.11' } })}
      ${'package.json'}        | ${'workspaces'}           | ${JSON.stringify({ workspaces: { catalogs: { test: { '@vitest/coverage-v8': '4.1.11' } } } })}
      ${'pnpm-workspace.yaml'} | ${'pnpm.catalog.default'} | ${'catalog:\n  "@vitest/coverage-v8": 4.1.11\n'}
      ${'pnpm-workspace.yaml'} | ${'pnpm.catalog.test'}    | ${'catalogs:\n  test:\n    "@vitest/coverage-v8": 4.1.11\n'}
      ${'.yarnrc.yml'}         | ${'yarn.catalog.test'}    | ${'catalogs:\n  test:\n    "@vitest/coverage-v8": 4.1.11\n'}
      ${'custom.yarnrc.yml'}   | ${'yarn.catalog.test'}    | ${'catalogs:\n  test:\n    "@vitest/coverage-v8": 4.1.11\n'}
    `(
      'recognizes the existing target in $packageFile $depType: $contents',
      async ({ packageFile, depType, contents }) => {
        const updateConfig = config('', '@vitest/coverage-v8', '4.1.11');
        Object.assign(updateConfig.upgrades[0], { packageFile, depType });
        getFileMock.mockResolvedValue(contents);

        const result = await hasReconciledVitePlusTargets({
          branchName,
          upgrades: updateConfig.upgrades,
        });

        expect(result).toBeTrue();
        expect(getFileMock).toHaveBeenCalledExactlyOnceWith(
          packageFile,
          branchName,
          { throwOnError: true },
        );
      },
    );

    it('reads each branch manifest once for multiple targets', async () => {
      const upgrades = [
        ...config('', 'vite-plus', '0.3.0').upgrades,
        ...config('', '@vitest/coverage-v8', '4.1.11').upgrades,
      ];
      getFileMock.mockResolvedValue(packageJson('0.3.0', '4.1.11'));

      const result = await hasReconciledVitePlusTargets({
        branchName,
        upgrades,
      });

      expect(result).toBeTrue();
      expect(getFileMock).toHaveBeenCalledExactlyOnceWith(
        'package.json',
        branchName,
        { throwOnError: true },
      );
    });

    it.each`
      packageFile              | depType                | contents
      ${'custom-package.json'} | ${'devDependencies'}   | ${JSON.stringify({ devDependencies: { '@vitest/coverage-v8': '4.1.10' } })}
      ${'custom.yarnrc.yml'}   | ${'yarn.catalog.test'} | ${'catalogs:\n  test:\n    "@vitest/coverage-v8": 4.1.10\n'}
    `(
      'does not confirm a different target in $packageFile',
      async ({ packageFile, depType, contents }) => {
        const { upgrades } = config('', '@vitest/coverage-v8', '4.1.11');
        Object.assign(upgrades[0], { packageFile, depType });
        getFileMock.mockResolvedValue(contents);

        const result = await hasReconciledVitePlusTargets({
          branchName,
          upgrades,
        });

        expect(result).toBeFalse();
      },
    );

    it('ignores unrelated upgrades in a mixed group', async () => {
      const upgrades = [
        ...config('', '@vitest/coverage-v8', '4.1.11').upgrades,
        ...config('', 'typescript', '6.0.0').upgrades,
      ];
      getFileMock.mockResolvedValue(packageJson('0.3.0', '4.1.11'));

      await expect(
        hasReconciledVitePlusTargets({ branchName, upgrades }),
      ).resolves.toBeTrue();
    });

    it('requires the target in every package file', async () => {
      const upgrades = [
        ...config('', '@vitest/coverage-v8', '4.1.11').upgrades,
        ...config('', '@vitest/coverage-v8', '4.1.11').upgrades.map(
          (upgrade) => ({ ...upgrade, packageFile: 'other/package.json' }),
        ),
      ];
      mockFiles({
        'package.json': packageJson('0.3.0', '4.1.11'),
        'other/package.json': packageJson('0.3.0', '4.1.10'),
      });

      const result = await hasReconciledVitePlusTargets({
        branchName,
        upgrades,
      });

      expect(result).toBeFalse();
    });

    it.each`
      contents
      ${null}
      ${''}
      ${'{"secret":"do-not-log"'}
      ${'[]'}
      ${' '.repeat(1024 * 1024 + 1)}
      ${packageJson('0.3.0', '^4.1.11')}
      ${packageJson('0.3.0', '4.1.10')}
      ${JSON.stringify({ peerDependencies: { '@vitest/coverage-v8': '4.1.11' } })}
      ${JSON.stringify({ devDependencies: { '@vitest/coverage-v8': '4.1.11', other: 'npm:@vitest/coverage-v8@4.1.10' } })}
    `(
      'does not confirm missing, invalid or different targets %#',
      async ({ contents }) => {
        const { upgrades } = config('', '@vitest/coverage-v8', '4.1.11');
        getFileMock.mockResolvedValue(contents);

        const result = await hasReconciledVitePlusTargets({
          branchName,
          upgrades,
        });

        expect(result).toBeFalse();
        expect(inspect(logger.logger.debug.mock.calls)).not.toContain(
          'do-not-log',
        );
      },
    );

    it('does not confirm a missing package file', async () => {
      const { upgrades } = config('', '@vitest/coverage-v8', '4.1.11');
      upgrades[0].packageFile = undefined;

      const result = await hasReconciledVitePlusTargets({
        branchName,
        upgrades,
      });

      expect(result).toBeFalse();
      expect(getFileMock).not.toHaveBeenCalled();
    });

    it.each`
      manager   | depType               | packageFile
      ${'npm'}  | ${'peerDependencies'} | ${'package.json'}
      ${'deno'} | ${'imports'}          | ${'deno.json'}
      ${'npm'}  | ${'devDependencies'}  | ${'custom-manifest.json'}
    `(
      'ignores declarations outside the planner: $manager $depType $packageFile',
      async ({ manager, depType, packageFile }) => {
        const { upgrades } = config('', '@vitest/coverage-v8', '4.1.11');
        Object.assign(upgrades[0], { manager, depType, packageFile });

        await expect(
          hasReconciledVitePlusTargets({ branchName, upgrades }),
        ).resolves.toBeTrue();
        expect(getFileMock).not.toHaveBeenCalled();
      },
    );

    it('does not match a target in another catalog', async () => {
      const { upgrades } = config('', '@vitest/coverage-v8', '4.1.11');
      Object.assign(upgrades[0], {
        packageFile: 'pnpm-workspace.yaml',
        depType: 'pnpm.catalog.test',
      });
      getFileMock.mockResolvedValue(
        'catalog:\n  "@vitest/coverage-v8": 4.1.11\n',
      );

      const result = await hasReconciledVitePlusTargets({
        branchName,
        upgrades,
      });

      expect(result).toBeFalse();
    });

    it('propagates repository read failures', async () => {
      const { upgrades } = config('', '@vitest/coverage-v8', '4.1.11');
      getFileMock.mockRejectedValueOnce(new Error(TEMPORARY_ERROR));

      await expect(
        hasReconciledVitePlusTargets({ branchName, upgrades }),
      ).rejects.toThrow(TEMPORARY_ERROR);
    });
  });

  it('does nothing unless the post-update option is enabled', async () => {
    await reconcileVitePlusVersions(
      partial<PostUpdateConfig<NpmManagerData>>({
        upgrades: [],
        postUpdateOptions: [],
      }),
      packageFiles(),
    );

    expect(execMock).not.toHaveBeenCalled();
    expect(getFileMock).not.toHaveBeenCalled();
  });

  it('uses the upgraded Vite+ binary to align its Vitest providers', async () => {
    const base = packageJson('0.2.0', '4.0.0');
    const proposed = packageJson('0.3.0', '4.0.0');
    const aligned = packageJson('0.3.0', '4.1.11');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, aligned));

    const notices = await reconcileVitePlusVersions(
      updateConfig,
      packageFiles(),
    );

    expect(
      additionContents(updateConfig.updatedPackageFiles?.[0] as FileAddition),
    ).toBe(aligned);
    expect(notices).toEqual([
      {
        file: 'package.json',
        message:
          'Vite+ aligned @vitest/coverage-v8 to 4.1.11 for compatibility.',
      },
    ]);
    expect(execMock).toHaveBeenCalledOnce();
    const [commands, options] = execMock.mock.calls[0];
    const execOptions = options!;
    expect(commands).toEqual([{ command: ['vp', 'sync-versions', '--json'] }]);
    expect(execOptions).toMatchObject({
      docker: {},
      maxBuffer: 33 * 1024 * 1024,
      redactOutput: true,
      toolConstraints: [
        {
          toolName: 'node',
          constraint: '^20.19.0 || ^22.18.0 || >=24.11.0',
        },
        { toolName: 'vp', constraint: '0.3.0' },
      ],
    });
    expect(execOptions.cwd).not.toContain('package.json');
    expect(JSON.parse(execOptions.input as string)).toEqual({
      schemaVersion: 1,
      workspace: '.',
      manifests: [
        { path: 'package.json', kind: 'packageJson', contents: proposed },
      ],
    });
    expect(updateConfig.upgrades[0]).toMatchObject({
      depName: 'vite-plus',
      newVersion: '0.3.0',
      newValue: '0.3.0',
      displayTo: '0.3.0',
      isBreaking: false,
      newMajor: 0,
      newMinor: 3,
      newPatch: 0,
      prettyNewVersion: 'v0.3.0',
      updateType: 'minor',
    });
  });

  it('recognizes an aliased Vite+ dependency by its package name', async () => {
    const base = aliasedVitePlusPackageJson('0.2.0', '4.0.0');
    const proposed = aliasedVitePlusPackageJson('0.3.0', '4.0.0');
    const aligned = aliasedVitePlusPackageJson('0.3.0', '4.1.11');
    const updateConfig = config(proposed);
    updateConfig.upgrades[0].depName = 'vp';
    updateConfig.upgrades[0].packageName = 'vite-plus';
    const files = packageFiles();
    files.npm![0].deps![0].depName = 'vp';
    files.npm![0].deps![0].packageName = 'vite-plus';
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, aligned));

    await reconcileVitePlusVersions(updateConfig, files);

    expect(execMock).toHaveBeenCalledOnce();
    expect(
      additionContents(updateConfig.updatedPackageFiles?.[0] as FileAddition),
    ).toBe(aligned);
  });

  it('preserves peer updates while aligning selected installation dependencies', async () => {
    const base = JSON.stringify({
      devDependencies: { 'vite-plus': '0.3.0', '@vitest/coverage-v8': '4.0.0' },
      peerDependencies: { vitest: '4.1.11' },
    });
    const proposed = base.replace('4.0.0', '4.2.0').replace('4.1.11', '4.2.0');
    const aligned = proposed.replace(
      '@vitest/coverage-v8":"4.2.0',
      '@vitest/coverage-v8":"4.1.11',
    );
    const updateConfig = config(proposed, '@vitest/coverage-v8', '4.2.0');
    updateConfig.upgrades.push({
      depName: 'vitest',
      depType: 'peerDependencies',
      packageFile: 'package.json',
      currentVersion: '4.1.11',
      currentValue: '4.1.11',
      newVersion: '4.2.0',
      newValue: '4.2.0',
      managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
    });
    const files = packageFiles();
    files.npm![0].deps![0].lockedVersion = '0.3.0';
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, aligned));

    const notices = await reconcileVitePlusVersions(updateConfig, files);

    expect(updateConfig.upgrades).toHaveLength(2);
    expect(updateConfig.upgrades[0]).toMatchObject({
      newVersion: '4.1.11',
      newValue: '4.1.11',
    });
    expect(updateConfig.upgrades[1]).toMatchObject({
      depType: 'peerDependencies',
      newVersion: '4.2.0',
      newValue: '4.2.0',
    });
    expect(updateConfig.updatedPackageFiles).toEqual([
      { type: 'addition', path: 'package.json', contents: aligned },
    ]);
    expect(notices).toEqual([]);
  });

  it('isolates independent workspaces selecting different Vite+ releases', async () => {
    const rootA = 'apps/a/package.json';
    const rootB = 'apps/b/package.json';
    const proposedA = packageJson('0.3.0', '4.0.0');
    const proposedB = packageJson('0.4.0', '4.0.0');
    const alignedA = packageJson('0.3.0', '4.1.11');
    const alignedB = packageJson('0.4.0', '4.2.0');
    const updateConfig = config(proposedA);
    updateConfig.upgrades[0].packageFile = rootA;
    updateConfig.upgrades[0].managerData = {
      pnpmLockFile: 'apps/a/pnpm-lock.yaml',
    };
    updateConfig.upgrades.push({
      ...updateConfig.upgrades[0],
      packageFile: rootB,
      newVersion: '0.4.0',
      newValue: '0.4.0',
      managerData: { pnpmLockFile: 'apps/b/pnpm-lock.yaml' },
    });
    updateConfig.updatedPackageFiles = [
      { type: 'addition', path: rootA, contents: proposedA },
      { type: 'addition', path: rootB, contents: proposedB },
    ];
    const files: AdditionalPackageFiles = {
      npm: [
        {
          ...packageFiles().npm![0],
          packageFile: rootA,
          managerData: { pnpmLockFile: 'apps/a/pnpm-lock.yaml' },
        },
        {
          ...packageFiles().npm![0],
          packageFile: rootB,
          managerData: { pnpmLockFile: 'apps/b/pnpm-lock.yaml' },
        },
      ],
    };
    mockFiles({
      [rootA]: packageJson('0.2.0', '4.0.0'),
      [rootB]: packageJson('0.2.0', '4.0.0'),
    });
    mockPlan((request) => {
      expect(request.manifests).toHaveLength(1);
      const manifest = request.manifests[0];
      const firstWorkspace = manifest.path === rootA;
      return {
        schemaVersion: 1,
        tool: {
          name: 'vite-plus',
          version: firstWorkspace ? '0.3.0' : '0.4.0',
        },
        workspace: '.',
        replacements: [
          {
            path: manifest.path,
            kind: manifest.kind,
            before: manifest.contents,
            after: firstWorkspace ? alignedA : alignedB,
          },
        ],
      };
    });

    await reconcileVitePlusVersions(updateConfig, files);

    expect(
      execMock.mock.calls.map(([, options]) => options?.toolConstraints?.[1]),
    ).toEqual([
      { toolName: 'vp', constraint: '0.3.0' },
      { toolName: 'vp', constraint: '0.4.0' },
    ]);
    expect(updateConfig.updatedPackageFiles).toEqual([
      { type: 'addition', path: rootA, contents: alignedA },
      { type: 'addition', path: rootB, contents: alignedB },
    ]);
    expect(updateConfig.upgrades.map(({ newVersion }) => newVersion)).toEqual([
      '0.3.0',
      '0.4.0',
    ]);
  });

  it('does not treat a custom package aliased as vite-plus as Vite+', async () => {
    const proposed = packageJson('0.3.0', '4.0.0');
    const updateConfig = config(proposed);
    updateConfig.upgrades[0].packageName = '@scope/vite-plus-fork';
    const files = packageFiles();
    files.npm![0].deps![0].packageName = '@scope/vite-plus-fork';

    await reconcileVitePlusVersions(updateConfig, files);

    expect(execMock).not.toHaveBeenCalled();
    expect(getFileMock).not.toHaveBeenCalled();
  });

  it('groups a workspace by package path when it has no lockfile metadata', async () => {
    const path = 'packages/app/package.json';
    const base = packageJson('0.2.0', '4.0.0');
    const proposed = packageJson('0.3.0', '4.0.0');
    const aligned = packageJson('0.3.0', '4.1.11');
    const files: AdditionalPackageFiles = {
      npm: [
        {
          packageFile: path,
          deps: packageFiles().npm![0].deps,
        },
      ],
    };
    const updateConfig = config(proposed);
    updateConfig.upgrades[0].packageFile = path;
    updateConfig.upgrades[0].managerData = undefined;
    updateConfig.updatedPackageFiles = [
      { type: 'addition', path, contents: proposed },
    ];
    mockFiles({ [path]: base });
    mockPlan((request) => validPlan(request, aligned, path));

    await reconcileVitePlusVersions(updateConfig, files);

    expect(
      additionContents(updateConfig.updatedPackageFiles[0] as FileAddition),
    ).toBe(aligned);
  });

  it('turns an incompatible provider-only update into a no-op', async () => {
    const base = packageJson('0.3.0', '4.1.11');
    const proposed = packageJson('0.3.0', '4.2.0');
    const updateConfig = config(proposed, '@vitest/coverage-v8', '4.2.0');
    updateConfig.upgrades[0].currentVersion = '4.1.11';
    updateConfig.upgrades[0].currentValue = '4.1.11';
    const files = packageFiles();
    files.npm![0].deps![0].currentVersion = '0.3.0';
    files.npm![0].deps![0].lockedVersion = '0.3.0';
    files.npm![0].deps![1].currentVersion = '4.1.11';
    files.npm![0].deps![1].lockedVersion = '4.1.11';
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, base));

    await reconcileVitePlusVersions(updateConfig, files);

    expect(updateConfig.updatedPackageFiles).toEqual([]);
    expect(updateConfig.upgrades).toEqual([]);
  });

  it('keeps a range-to-exact pin when the resolved version is unchanged', async () => {
    const base = packageJson('0.3.0', '^4.1.0');
    const proposed = packageJson('0.3.0', '4.2.0');
    const aligned = packageJson('0.3.0', '4.1.11');
    const updateConfig = config(proposed, '@vitest/coverage-v8', '4.2.0');
    updateConfig.upgrades[0].currentVersion = '4.1.11';
    updateConfig.upgrades[0].currentValue = '^4.1.0';
    const files = packageFiles();
    files.npm![0].deps![0].currentVersion = '0.3.0';
    files.npm![0].deps![0].lockedVersion = '0.3.0';
    files.npm![0].deps![1].currentVersion = '4.1.11';
    files.npm![0].deps![1].lockedVersion = '4.1.11';
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, aligned));

    await reconcileVitePlusVersions(updateConfig, files);

    expect(updateConfig.upgrades).toHaveLength(1);
    expect(updateConfig.upgrades[0]).toMatchObject({
      currentValue: '^4.1.0',
      isBreaking: false,
      newValue: '4.1.11',
      newVersion: '4.1.11',
      updateType: 'pin',
    });
    expect(
      additionContents(updateConfig.updatedPackageFiles?.[0] as FileAddition),
    ).toBe(aligned);
  });

  it('writes a reversion when reusing a branch with stale manifest content', async () => {
    const base = packageJson('0.3.0', '4.1.11');
    const staleBranch = packageJson('0.3.0', '4.2.0');
    const updateConfig = config(staleBranch, '@vitest/coverage-v8', '4.2.0');
    updateConfig.reuseExistingBranch = true;
    updateConfig.branchName = 'renovate/vite-plus';
    const files = packageFiles();
    files.npm![0].deps![0].currentVersion = '0.3.0';
    files.npm![0].deps![0].lockedVersion = '0.3.0';
    files.npm![0].deps![1].currentVersion = '4.1.11';
    files.npm![0].deps![1].lockedVersion = '4.1.11';
    getFileMock.mockImplementation((_path, branch) =>
      Promise.resolve(branch === 'renovate/vite-plus' ? staleBranch : base),
    );
    mockPlan((request) => validPlan(request, base));

    await reconcileVitePlusVersions(updateConfig, files);

    expect(
      additionContents(updateConfig.updatedPackageFiles?.[0] as FileAddition),
    ).toBe(base);
  });

  it('reconciles pnpm workspace catalogs in the existing artifact entry', async () => {
    const basePackage = packageJson('0.3.0', 'catalog:');
    const baseWorkspace = 'catalog:\n  "@vitest/coverage-v8": 4.1.11\n';
    const proposedWorkspace = 'catalog:\n  "@vitest/coverage-v8": 4.2.0\n';
    const updateConfig = config(basePackage, '@vitest/coverage-v8', '4.2.0');
    updateConfig.updatedPackageFiles = [];
    updateConfig.updatedArtifacts = [
      {
        type: 'addition',
        path: 'pnpm-workspace.yaml',
        contents: proposedWorkspace,
      },
    ];
    const files = packageFiles();
    files.npm![0].deps![0].currentVersion = '0.3.0';
    files.npm![0].deps![0].lockedVersion = '0.3.0';
    mockFiles({
      'package.json': basePackage,
      'pnpm-workspace.yaml': baseWorkspace,
    });
    mockPlan((request) =>
      validPlan(request, baseWorkspace, 'pnpm-workspace.yaml'),
    );

    await reconcileVitePlusVersions(updateConfig, files);

    expect(updateConfig.updatedArtifacts).toEqual([]);
  });

  it('updates an existing workspace artifact without reclassifying it', async () => {
    const basePackage = packageJson('0.3.0', 'catalog:');
    const baseWorkspace =
      'catalog:\n  "@vitest/coverage-v8": 4.0.0\ncatalogs:\n  test:\n    vitest: 4.0.0\noverrides:\n  "app>@vitest/browser-playwright@4": 4.0.0\n';
    const alignedWorkspace = baseWorkspace.replaceAll('4.0.0', '4.1.11');
    const updateConfig = config(basePackage, '@vitest/coverage-v8', '4.1.11');
    updateConfig.updatedPackageFiles = [];
    updateConfig.updatedArtifacts = [
      {
        type: 'addition',
        path: 'pnpm-workspace.yaml',
        contents: baseWorkspace,
      },
    ];
    const files = packageFiles();
    files.npm![0].deps![0].currentVersion = '0.3.0';
    files.npm![0].deps![0].lockedVersion = '0.3.0';
    mockFiles({
      'package.json': basePackage,
      'pnpm-workspace.yaml': baseWorkspace,
    });
    mockPlan((request) =>
      validPlan(request, alignedWorkspace, 'pnpm-workspace.yaml'),
    );

    await reconcileVitePlusVersions(updateConfig, files);

    expect(
      additionContents(updateConfig.updatedArtifacts?.[0] as FileAddition),
    ).toBe(alignedWorkspace);
  });

  it('reconciles Yarn catalogs and managed npm aliases', async () => {
    const basePackage = packageJson('0.2.0', 'catalog:vite-plus');
    const proposedPackage = packageJson('0.3.0', 'catalog:vite-plus');
    const baseYarnRc =
      "catalogs:\n  vite-plus:\n    vite: 'npm:@voidzero-dev/vite-plus-core@0.2.0'\n    '@vitest/coverage-v8': 4.0.0\n";
    const alignedYarnRc = baseYarnRc
      .replace('vite-plus-core@0.2.0', 'vite-plus-core@0.3.0')
      .replace('4.0.0', '4.1.11');
    const updateConfig = config(proposedPackage);
    updateConfig.upgrades[0].managerData = { yarnLock: 'yarn.lock' };
    updateConfig.upgrades.push({
      depName: 'vite',
      depType: 'yarn.catalog.vite-plus',
      packageName: '@voidzero-dev/vite-plus-core',
      packageFile: '.yarnrc.yml',
      currentVersion: '0.2.0',
      currentValue: '0.2.0',
      newVersion: '0.4.0',
      newValue: '0.4.0',
      npmPackageAlias: true,
      managerData: { yarnLock: 'yarn.lock' },
    });
    const files = packageFiles();
    files.npm![0].managerData = { yarnLock: 'yarn.lock' };
    files.npm!.push({
      packageFile: '.yarnrc.yml',
      managerData: { yarnLock: 'yarn.lock' },
      deps: [
        {
          depName: 'vite',
          packageName: '@voidzero-dev/vite-plus-core',
          currentVersion: '0.2.0',
          currentValue: '0.2.0',
          lockedVersion: '0.2.0',
          npmPackageAlias: true,
        },
      ],
    });
    mockFiles({
      '.yarnrc.yml': baseYarnRc,
      'package.json': basePackage,
    });
    mockPlan((request) => {
      expect(request.manifests).toEqual([
        { path: '.yarnrc.yml', kind: 'yarnRc', contents: baseYarnRc },
        {
          path: 'package.json',
          kind: 'packageJson',
          contents: proposedPackage,
        },
      ]);
      return validPlan(request, alignedYarnRc, '.yarnrc.yml');
    });

    await reconcileVitePlusVersions(updateConfig, files);

    expect(
      additionContents(updateConfig.updatedPackageFiles?.[1] as FileAddition),
    ).toBe(alignedYarnRc);
    expect(updateConfig.upgrades[1]).toMatchObject({
      depName: 'vite',
      packageName: '@voidzero-dev/vite-plus-core',
      newVersion: '0.3.0',
      newValue: '0.3.0',
      displayTo: '0.3.0',
      updateType: 'minor',
    });
  });

  it('adds a planner replacement when Renovate has no existing addition', async () => {
    const base = packageJson('0.2.0', '4.0.0');
    const aligned = packageJson('0.3.0', '4.1.11');
    const updateConfig = config(base);
    updateConfig.updatedPackageFiles = [];
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, aligned));

    await reconcileVitePlusVersions(updateConfig, packageFiles());

    expect(updateConfig.updatedPackageFiles).toEqual([
      { type: 'addition', path: 'package.json', contents: aligned },
    ]);
  });

  it('rejects a deleted manifest before invoking the planner', async () => {
    const updateConfig = config(packageJson('0.3.0', '4.0.0'));
    updateConfig.updatedPackageFiles = [
      { type: 'deletion', path: 'package.json' },
    ];

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('Cannot reconcile deleted Vite+ manifest');
    expect(execMock).not.toHaveBeenCalled();
  });

  it('accepts managed package selectors in override maps', async () => {
    const base = `${JSON.stringify({
      devDependencies: { 'vite-plus': '0.2.0' },
      pnpm: { overrides: { 'app>@vitest/coverage-v8@4': '4.0.0' } },
      resolutions: { '**/vitest': '4.0.0' },
    })}\n`;
    const proposed = base.replace('0.2.0', '0.3.0');
    const aligned = proposed.replaceAll('4.0.0', '4.1.11');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, aligned));

    await reconcileVitePlusVersions(updateConfig, packageFiles());

    expect(
      additionContents(updateConfig.updatedPackageFiles?.[0] as FileAddition),
    ).toBe(aligned);
  });

  it('accepts nested npm overrides and Bun workspace catalogs', async () => {
    const base = `${JSON.stringify({
      devDependencies: { 'vite-plus': '0.2.0' },
      overrides: {
        app: { vitest: '4.0.0' },
        vitest: { '.': '4.0.0' },
      },
      workspaces: {
        catalog: { '@vitest/coverage-v8': '4.0.0' },
        catalogs: {
          test: { '@vitest/browser-playwright': '4.0.0' },
        },
      },
    })}\n`;
    const proposed = base.replace('0.2.0', '0.3.0');
    const aligned = proposed.replaceAll('4.0.0', '4.1.11');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, aligned));

    await reconcileVitePlusVersions(updateConfig, packageFiles());

    expect(
      additionContents(updateConfig.updatedPackageFiles?.[0] as FileAddition),
    ).toBe(aligned);
  });

  it.each([
    {
      name: 'an unknown path',
      mutate: (plan: any) => {
        plan.replacements[0].path = '../package.json';
      },
      message: 'unknown manifest',
    },
    {
      name: 'stale input',
      mutate: (plan: any) => {
        plan.replacements[0].before = '{}';
      },
      message: 'stale',
    },
    {
      name: 'an unrelated key',
      mutate: (plan: any) => {
        plan.replacements[0].after = JSON.stringify({ scripts: {} });
      },
      message: 'add or remove manifest keys',
    },
    {
      name: 'a mismatched tool version',
      mutate: (plan: any) => {
        plan.tool.version = '0.4.0';
      },
      message: 'does not match',
    },
    {
      name: 'a duplicate replacement',
      mutate: (plan: any) => {
        plan.replacements.push({ ...plan.replacements[0] });
      },
      message: 'duplicate replacement',
    },
    {
      name: 'a mismatched manifest kind',
      mutate: (plan: any) => {
        plan.replacements[0].kind = 'pnpmWorkspace';
      },
      message: 'unknown manifest',
    },
    {
      name: 'an unsupported plan schema',
      mutate: (plan: any) => {
        plan.schemaVersion = 2;
      },
      message: 'invalid sync plan',
    },
    {
      name: 'an unexpected Vite+ target',
      mutate: (plan: any) => {
        plan.replacements[0].after = packageJson('0.4.0', '4.1.11');
      },
      message: 'unexpected Vite+ version',
    },
    {
      name: 'a replacement without semantic changes',
      mutate: (plan: any) => {
        plan.replacements[0].after = plan.replacements[0].before;
      },
      message: 'without dependency changes',
    },
    {
      name: 'a non-version dependency value',
      mutate: (plan: any) => {
        plan.replacements[0].after = packageJson('0.3.0', 'latest');
      },
      message: 'unsupported manifest change',
    },
    {
      name: 'an invalid manifest tree',
      mutate: (plan: any) => {
        plan.replacements[0].after = 'null';
      },
      message: 'invalid packageJson manifest',
    },
  ])('rejects $name before applying it', async ({ mutate, message }) => {
    const base = packageJson('0.2.0', '4.0.0');
    const proposed = packageJson('0.3.0', '4.0.0');
    const aligned = packageJson('0.3.0', '4.1.11');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': base });
    mockPlan((request) => {
      const plan = validPlan(request, aligned) as any;
      mutate(plan);
      return plan;
    });

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow(message);
    expect(
      additionContents(updateConfig.updatedPackageFiles?.[0] as FileAddition),
    ).toBe(proposed);
  });

  it('rejects invalid planner JSON', async () => {
    const proposed = packageJson('0.3.0', '4.0.0');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': packageJson('0.2.0', '4.0.0') });
    execMock.mockResolvedValueOnce({ stdout: '{', stderr: '' });

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('invalid sync plan JSON');
  });

  it.each([
    {
      name: 'schema diagnostics',
      mutate: (plan: any, secret: string) => {
        plan[secret] = true;
      },
    },
    {
      name: 'tool version',
      mutate: (plan: any, secret: string) => {
        plan.tool.version = secret;
      },
    },
    {
      name: 'replacement path',
      mutate: (plan: any, secret: string) => {
        plan.replacements[0].path = secret;
      },
    },
  ])('does not expose response values through $name', async ({ mutate }) => {
    const secret = 'SYNTHETIC_PRIVATE_MANIFEST_VALUE';
    const proposed = packageJson('0.3.0', '4.0.0');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': packageJson('0.2.0', '4.0.0') });
    mockPlan((request) => {
      const plan = validPlan(request, packageJson('0.3.0', '4.1.11'));
      mutate(plan, secret);
      return plan;
    });

    const error = await reconcileVitePlusVersions(
      updateConfig,
      packageFiles(),
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect(inspect(error)).not.toContain(secret);
    expect(
      additionContents(updateConfig.updatedPackageFiles?.[0] as FileAddition),
    ).toBe(proposed);
  });

  it('does not expose manifest contents through YAML parsing errors', async () => {
    const secret = 'SYNTHETIC_PRIVATE_MANIFEST_VALUE';
    const proposed = packageJson('0.3.0', '4.0.0');
    mockFiles({
      'package.json': packageJson('0.2.0', '4.0.0'),
      'pnpm-workspace.yaml': `npmAuthToken: ${secret}\nnpmAuthToken: duplicate\n`,
    });
    mockPlan((request) => validPlan(request, packageJson('0.3.0', '4.1.11')));

    const error = await reconcileVitePlusVersions(
      config(proposed),
      packageFiles(),
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect(inspect(error)).not.toContain(secret);
    expect(error).not.toHaveProperty('errors');
  });

  it('rejects a change to an existing non-dependency field', async () => {
    const base = `${JSON.stringify({
      name: 'app',
      devDependencies: { 'vite-plus': '0.2.0' },
    })}\n`;
    const proposed = base.replace('0.2.0', '0.3.0');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, proposed.replace('app', 'other')));

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('Vite+ attempted an unsupported manifest change');
  });

  it.each([
    {
      name: 'introduces an alias',
      before: '0.2.0',
      after: 'npm:@voidzero-dev/vite-plus-core@0.3.0',
    },
    {
      name: 'removes an alias',
      before: 'npm:@voidzero-dev/vite-plus-core@0.2.0',
      after: '0.3.0',
    },
    {
      name: 'changes the alias target',
      before: 'npm:@voidzero-dev/vite-plus-core@0.2.0',
      after: 'npm:vite@0.3.0',
    },
    {
      name: 'updates an unmanaged alias',
      before: 'npm:vite@7.0.0',
      after: 'npm:vite@7.1.0',
    },
    {
      name: 'uses a non-version alias target',
      before: 'npm:@voidzero-dev/vite-plus-core@0.2.0',
      after: 'npm:@voidzero-dev/vite-plus-core@latest',
    },
    {
      name: 'replaces a non-version alias target',
      before: 'npm:@voidzero-dev/vite-plus-core@latest',
      after: 'npm:@voidzero-dev/vite-plus-core@0.3.0',
    },
  ])('rejects a plan that $name', async ({ before, after }) => {
    const base = aliasedPackageJson('0.2.0', before);
    const proposed = aliasedPackageJson('0.3.0', before);
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': base });
    mockPlan((request) =>
      validPlan(request, aliasedPackageJson('0.3.0', after)),
    );

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('Vite+ attempted an unsupported manifest change');
  });

  it.each([
    { name: 'workspace protocol', value: 'workspace:*' },
    { name: 'catalog protocol', value: 'catalog:' },
    { name: 'dependency reference', value: '$vitest' },
    { name: 'distribution tag', value: 'latest' },
  ])('rejects replacing a $name with an exact version', async ({ value }) => {
    const base = packageJson('0.2.0', value);
    const proposed = packageJson('0.3.0', value);
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, packageJson('0.3.0', '4.1.11')));

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('Vite+ attempted an unsupported manifest change');
  });

  it('rejects an unexpected version inside a managed npm alias', async () => {
    const base = aliasedPackageJson(
      '0.2.0',
      'npm:@voidzero-dev/vite-plus-core@0.2.0',
    );
    const proposed = aliasedPackageJson(
      '0.3.0',
      'npm:@voidzero-dev/vite-plus-core@0.2.0',
    );
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': base });
    mockPlan((request) =>
      validPlan(
        request,
        aliasedPackageJson('0.3.0', 'npm:@voidzero-dev/vite-plus-core@0.4.0'),
      ),
    );

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('unexpected Vite+ version');
  });

  it('rejects a change to an existing non-dependency YAML field', async () => {
    const basePackage = packageJson('0.3.0', 'catalog:');
    const workspace =
      'packages:\n  - packages/*\ncatalog:\n  "@vitest/coverage-v8": 4.0.0\n';
    const updateConfig = config(basePackage, '@vitest/coverage-v8', '4.1.11');
    updateConfig.updatedPackageFiles = [];
    const files = packageFiles();
    files.npm![0].deps![0].currentVersion = '0.3.0';
    files.npm![0].deps![0].lockedVersion = '0.3.0';
    mockFiles({
      'package.json': basePackage,
      'pnpm-workspace.yaml': workspace,
    });
    mockPlan((request) =>
      validPlan(
        request,
        workspace.replace('packages/*', 'apps/*').replace('4.0.0', '4.1.11'),
        'pnpm-workspace.yaml',
      ),
    );

    await expect(
      reconcileVitePlusVersions(updateConfig, files),
    ).rejects.toThrow('Vite+ attempted an unsupported manifest change');
  });

  it('rejects a change to a non-catalog Yarn setting', async () => {
    const basePackage = packageJson('0.3.0', 'catalog:');
    const yarnRc = 'nodeLinker: pnp\ncatalog:\n  vitest: 4.0.0\n';
    const updateConfig = config(basePackage, 'vitest', '4.1.11');
    updateConfig.updatedPackageFiles = [];
    updateConfig.upgrades[0].managerData = { yarnLock: 'yarn.lock' };
    const files = packageFiles();
    files.npm![0].managerData = { yarnLock: 'yarn.lock' };
    files.npm![0].deps![0].currentVersion = '0.3.0';
    files.npm![0].deps![0].lockedVersion = '0.3.0';
    files.npm!.push({
      packageFile: '.yarnrc.yml',
      managerData: { yarnLock: 'yarn.lock' },
      deps: [],
    });
    mockFiles({
      '.yarnrc.yml': yarnRc,
      'package.json': basePackage,
    });
    mockPlan((request) =>
      validPlan(
        request,
        yarnRc.replace('nodeLinker: pnp', 'nodeLinker: node-modules'),
        '.yarnrc.yml',
      ),
    );

    await expect(
      reconcileVitePlusVersions(updateConfig, files),
    ).rejects.toThrow('Vite+ attempted an unsupported manifest change');
  });

  it('rejects inconsistent Vitest ecosystem versions', async () => {
    const base = `${JSON.stringify({
      devDependencies: {
        'vite-plus': '0.2.0',
        vitest: '4.0.0',
        '@vitest/coverage-v8': '4.0.0',
      },
    })}\n`;
    const proposed = base.replace('0.2.0', '0.3.0');
    const aligned = proposed
      .replace('vitest":"4.0.0', 'vitest":"4.1.11')
      .replace('@vitest/coverage-v8":"4.0.0', '@vitest/coverage-v8":"4.1.12');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, aligned));

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('inconsistent Vitest ecosystem versions');
  });

  it('rejects a partial plan that leaves an inconsistent declaration unchanged', async () => {
    const proposed = JSON.stringify({
      devDependencies: {
        'vite-plus': '0.3.0',
        vitest: '4.0.0',
        '@vitest/coverage-v8': '4.0.0',
      },
    });
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': proposed });
    mockPlan((request) =>
      validPlan(request, proposed.replace('vitest":"4.0.0', 'vitest":"4.1.11')),
    );

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('inconsistent Vitest ecosystem versions');

    expect(updateConfig.updatedPackageFiles).toEqual([
      { type: 'addition', path: 'package.json', contents: proposed },
    ]);
  });

  it('rejects a partial plan that leaves an inconsistent manifest unchanged', async () => {
    const proposed = packageJson('0.3.0', '4.0.0');
    const updateConfig = config(proposed);
    const files = packageFiles();
    files.npm!.push({
      packageFile: 'packages/test/package.json',
      managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
      deps: [],
    });
    mockFiles({
      'package.json': proposed,
      'packages/test/package.json': JSON.stringify({
        devDependencies: { vitest: '4.0.0' },
      }),
    });
    mockPlan((request) => validPlan(request, packageJson('0.3.0', '4.1.11')));

    await expect(
      reconcileVitePlusVersions(updateConfig, files),
    ).rejects.toThrow('inconsistent Vitest ecosystem versions');

    expect(updateConfig.updatedPackageFiles).toEqual([
      { type: 'addition', path: 'package.json', contents: proposed },
    ]);
  });

  it.each([
    { depName: 'vitest', value: '^4.0.0' },
    { depName: 'vitest', value: '^5.0.0' },
    { depName: 'test', value: 'npm:vitest@^4.0.0' },
  ])('rejects a retained managed range $value', async ({ depName, value }) => {
    const proposed = JSON.stringify({
      devDependencies: {
        'vite-plus': '0.3.0',
        '@vitest/coverage-v8': '4.0.0',
        [depName]: value,
      },
    });
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': proposed });
    mockPlan((request) =>
      validPlan(
        request,
        proposed.replace('coverage-v8":"4.0.0', 'coverage-v8":"5.0.3'),
      ),
    );

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('non-exact managed version');

    expect(updateConfig.updatedPackageFiles).toEqual([
      { type: 'addition', path: 'package.json', contents: proposed },
    ]);
  });

  it('rejects a retained managed range in a no-op plan', async () => {
    const proposed = packageJson('0.3.0', '^4.0.0');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': proposed });
    mockPlan(() => ({
      schemaVersion: 1,
      tool: { name: 'vite-plus', version: '0.3.0' },
      workspace: '.',
      replacements: [],
    }));

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('non-exact managed version');

    expect(updateConfig.updatedPackageFiles).toEqual([
      { type: 'addition', path: 'package.json', contents: proposed },
    ]);
  });

  it.each([
    { depName: 'vite-plus', value: '0.2.0' },
    { depName: 'vite', value: 'npm:@voidzero-dev/vite-plus-core@0.2.0' },
  ])(
    'rejects an unchanged $depName declaration for another release',
    async ({ depName, value }) => {
      const proposed = packageJson('0.3.0', '4.0.0');
      const updateConfig = config(proposed);
      const files = packageFiles();
      files.npm!.push({
        packageFile: 'packages/test/package.json',
        managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
        deps: [],
      });
      mockFiles({
        'package.json': proposed,
        'packages/test/package.json': JSON.stringify({
          devDependencies: { [depName]: value },
        }),
      });
      mockPlan((request) => validPlan(request, packageJson('0.3.0', '4.1.11')));

      await expect(
        reconcileVitePlusVersions(updateConfig, files),
      ).rejects.toThrow('unexpected Vite+ version');

      expect(updateConfig.updatedPackageFiles).toEqual([
        { type: 'addition', path: 'package.json', contents: proposed },
      ]);
    },
  );

  it.each([true, false])(
    'accepts consistent final declarations with replacements=%s',
    async (hasReplacement) => {
      const proposed = packageJson(
        '0.3.0',
        hasReplacement ? '4.0.0' : '4.1.11',
      );
      const aligned = packageJson('0.3.0', '4.1.11');
      const updateConfig = config(proposed);
      const files = packageFiles();
      files.npm!.push({
        packageFile: 'packages/test/package.json',
        managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
        deps: [],
      });
      mockFiles({
        'package.json': proposed,
        'packages/test/package.json': JSON.stringify({
          devDependencies: {
            test: 'npm:vitest@4.1.11',
            '@vitest/eslint-plugin': '1.0.0',
          },
          peerDependencies: { vitest: '^3.0.0' },
        }),
      });
      mockPlan((request) =>
        hasReplacement
          ? validPlan(request, aligned)
          : {
              schemaVersion: 1,
              tool: { name: 'vite-plus', version: '0.3.0' },
              workspace: '.',
              replacements: [],
            },
      );

      await reconcileVitePlusVersions(updateConfig, files);

      expect(updateConfig.updatedPackageFiles).toEqual([
        { type: 'addition', path: 'package.json', contents: aligned },
      ]);
    },
  );

  it('requires an exact, unambiguous Vite+ version', async () => {
    const files = packageFiles();
    files.npm![0].deps![0].currentVersion = undefined;
    files.npm![0].deps![0].lockedVersion = undefined;
    const updateConfig = config(
      packageJson('workspace:*', '4.2.0'),
      '@vitest/coverage-v8',
      '4.2.0',
    );

    await expect(
      reconcileVitePlusVersions(updateConfig, files),
    ).rejects.toThrow('requires one exact Vite+ version');
    expect(execMock).not.toHaveBeenCalled();
  });

  it('skips workspaces without relevant upgrades or Vite+', async () => {
    const noRelevantUpgrade = config(packageJson('0.3.0', '4.0.0'));
    noRelevantUpgrade.upgrades[0].depName = 'react';
    noRelevantUpgrade.upgrades.push({ depName: 'vitest' });
    const filesWithUnrootedEntry = packageFiles();
    filesWithUnrootedEntry.npm?.push({});
    filesWithUnrootedEntry.npm?.push({
      packageFile: 'packages/other/package.json',
      managerData: { pnpmLockFile: 'packages/other/pnpm-lock.yaml' },
      deps: [],
    });
    await reconcileVitePlusVersions(noRelevantUpgrade, filesWithUnrootedEntry);

    const noVitePlus = packageFiles();
    noVitePlus.npm![0].deps = noVitePlus.npm![0].deps?.filter(
      (dependency) => dependency.depName !== 'vite-plus',
    );
    await reconcileVitePlusVersions(
      config(packageJson('0.3.0', '4.2.0'), '@vitest/coverage-v8', '4.2.0'),
      noVitePlus,
    );

    expect(execMock).not.toHaveBeenCalled();
    expect(getFileMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized manifest', async () => {
    const oversized = `{"value":"${'a'.repeat(1024 * 1024)}"}`;
    const updateConfig = config(oversized);
    mockFiles({ 'package.json': packageJson('0.2.0', '4.0.0') });

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('manifest exceeds the protocol limit');
    expect(execMock).not.toHaveBeenCalled();
  });

  it('rejects workspaces with too many manifests', async () => {
    const files = packageFiles();
    files.npm = Array.from({ length: 257 }, (_, index) => ({
      packageFile: `packages/${index}/package.json`,
      managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
      deps:
        index === 0
          ? [
              {
                depName: 'vite-plus',
                currentVersion: '0.2.0',
                lockedVersion: '0.2.0',
              },
            ]
          : [],
    }));
    const updateConfig = config(packageJson('0.3.0', '4.0.0'));
    updateConfig.updatedPackageFiles = [];
    getFileMock.mockImplementation((path) =>
      Promise.resolve(path.endsWith('package.json') ? '{}' : null),
    );

    await expect(
      reconcileVitePlusVersions(updateConfig, files),
    ).rejects.toThrow('exceeds the manifest count limit');
    expect(execMock).not.toHaveBeenCalled();
  });

  it('rejects a workspace request above the aggregate protocol limit', async () => {
    const largeManifest = `{"value":"${'a'.repeat(1_000_000)}"}`;
    const files = packageFiles();
    files.npm = Array.from({ length: 17 }, (_, index) => ({
      packageFile: `packages/${index}/package.json`,
      managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
      deps:
        index === 0
          ? [
              {
                depName: 'vite-plus',
                currentVersion: '0.2.0',
                lockedVersion: '0.2.0',
              },
            ]
          : [],
    }));
    const updateConfig = config(packageJson('0.3.0', '4.0.0'));
    updateConfig.updatedPackageFiles = [];
    getFileMock.mockImplementation((path) =>
      Promise.resolve(path.endsWith('package.json') ? largeManifest : null),
    );

    await expect(
      reconcileVitePlusVersions(updateConfig, files),
    ).rejects.toThrow('workspace . exceeds the protocol limit');
    expect(execMock).not.toHaveBeenCalled();
  });

  it('rejects a workspace with no materialized manifests', async () => {
    const files: AdditionalPackageFiles = {
      npm: [
        {
          managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
          deps: [
            {
              depName: 'vite-plus',
              currentVersion: '0.2.0',
              lockedVersion: '0.2.0',
            },
          ],
        },
      ],
    };
    const updateConfig = config(packageJson('0.3.0', '4.0.0'));
    updateConfig.updatedPackageFiles = [];
    mockFiles({});

    await expect(
      reconcileVitePlusVersions(updateConfig, files),
    ).rejects.toThrow('No Vite+ manifests found');
    expect(execMock).not.toHaveBeenCalled();
  });

  it('leaves legacy Vite+ releases unchanged when no planner is available', async () => {
    const base = packageJson('0.2.0', '4.0.0');
    const proposed = packageJson('0.3.0', '4.0.0');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': base });
    execMock.mockRejectedValueOnce(
      new ExecError('Command failed', {
        cmd: 'install-tool vp 0.3.0',
        options: {},
        stderr: '',
        stdout:
          'CONTAINERBASE_VP_SYNC_VERSIONS_UNAVAILABLE:0.3.0: Vite+ release does not provide the sync-versions planner',
      }),
    );

    const notices = await reconcileVitePlusVersions(
      updateConfig,
      packageFiles(),
    );

    expect(
      additionContents(updateConfig.updatedPackageFiles?.[0] as FileAddition),
    ).toBe(proposed);
    expect(notices).toEqual([
      {
        file: 'package.json',
        message:
          'Vite+ 0.3.0 predates version reconciliation support; declared versions were left unchanged.',
      },
    ]);
  });

  it('leaves versions unchanged when dynamic tool installation is unavailable', async () => {
    GlobalConfig.set({ binarySource: 'global' });
    const proposed = packageJson('0.3.0', '4.0.0');
    const updateConfig = config(proposed);
    updateConfig.upgrades[0].packageFile = 'packages/app/package.json';
    updateConfig.upgrades[0].managerData = {
      pnpmLockFile: 'packages/app/pnpm-lock.yaml',
    };
    updateConfig.updatedPackageFiles = [
      {
        type: 'addition',
        path: 'packages/app/package.json',
        contents: proposed,
      },
    ];
    const files = packageFiles();
    files.npm![0].packageFile = 'packages/app/package.json';
    files.npm![0].managerData = {
      pnpmLockFile: 'packages/app/pnpm-lock.yaml',
    };

    const notices = await reconcileVitePlusVersions(updateConfig, files);

    expect(execMock).not.toHaveBeenCalled();
    expect(getFileMock).not.toHaveBeenCalled();
    expect(notices).toEqual([
      {
        file: 'packages/app/package.json',
        message:
          'Vite+ version reconciliation requires Renovate dynamic tool installation; leaving declared versions unchanged.',
      },
    ]);
  });

  it.each([undefined, 'workspace:*'])(
    'does not derive an update type from a non-exact current version',
    async (currentVersion) => {
      const base = packageJson('0.2.0', '4.0.0');
      const proposed = packageJson('0.3.0', '4.0.0');
      const updateConfig = config(proposed);
      updateConfig.upgrades[0].currentVersion = currentVersion;
      mockFiles({ 'package.json': base });
      mockPlan(() => ({
        schemaVersion: 1,
        tool: { name: 'vite-plus', version: '0.3.0' },
        workspace: '.',
        replacements: [],
      }));

      await reconcileVitePlusVersions(updateConfig, packageFiles());

      expect(updateConfig.upgrades[0].updateType).toBeUndefined();
    },
  );

  it('derives major metadata after aligning a provider', async () => {
    const base = packageJson('0.3.0', '4.0.0');
    const proposed = packageJson('0.3.0', '4.2.0');
    const aligned = packageJson('0.3.0', '5.0.0');
    const updateConfig = config(proposed, '@vitest/coverage-v8', '4.2.0');
    const files = packageFiles();
    files.npm![0].deps![0].currentVersion = '0.3.0';
    files.npm![0].deps![0].lockedVersion = '0.3.0';
    mockFiles({ 'package.json': base });
    mockPlan((request) => validPlan(request, aligned));

    await reconcileVitePlusVersions(updateConfig, files);

    expect(updateConfig.upgrades[0]).toMatchObject({
      isBreaking: true,
      newMajor: 5,
      updateType: 'major',
    });
  });

  it('derives patch metadata after aligning a Vite+ update', async () => {
    const base = packageJson('0.3.0', '4.0.0');
    const proposed = packageJson('0.3.1', '4.0.0');
    const aligned = packageJson('0.3.1', '4.1.11');
    const updateConfig = config(proposed, 'vite-plus', '0.3.1');
    updateConfig.upgrades[0].currentVersion = '0.3.0';
    const files = packageFiles();
    files.npm![0].deps![0].currentVersion = '0.3.0';
    files.npm![0].deps![0].lockedVersion = '0.3.0';
    mockFiles({ 'package.json': base });
    mockPlan((request) => {
      const plan = validPlan(request, aligned) as any;
      plan.tool.version = '0.3.1';
      return plan;
    });

    await reconcileVitePlusVersions(updateConfig, files);

    expect(updateConfig.upgrades[0]).toMatchObject({
      isBreaking: false,
      newMinor: 3,
      updateType: 'patch',
    });
  });

  it('leaves unrelated upgrade metadata alone when the plan has no Vitest change', async () => {
    const base = `${JSON.stringify({
      devDependencies: { 'vite-plus': '0.2.0' },
    })}\n`;
    const proposed = base.replace('0.2.0', '0.3.0');
    const updateConfig = config(proposed);
    updateConfig.upgrades.push({
      depName: '@vitest/coverage-v8',
      packageFile: 'package.json',
      currentVersion: '4.0.0',
      newVersion: '4.2.0',
      newValue: '4.2.0',
      managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
    });
    const files = packageFiles();
    files.npm![0].deps = files.npm![0].deps?.filter(
      (dependency) => dependency.depName === 'vite-plus',
    );
    mockFiles({ 'package.json': base });
    mockPlan(() => ({
      schemaVersion: 1,
      tool: { name: 'vite-plus', version: '0.3.0' },
      workspace: '.',
      replacements: [],
    }));

    await reconcileVitePlusVersions(updateConfig, files);

    expect(updateConfig.upgrades[1]).toMatchObject({
      depName: '@vitest/coverage-v8',
      newVersion: '4.2.0',
      newValue: '4.2.0',
    });
  });

  it('does not expose planner output through unrelated failures', async () => {
    const proposed = packageJson('0.3.0', '4.0.0');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': packageJson('0.2.0', '4.0.0') });
    const secret = 'private-yarn-token';
    execMock.mockRejectedValueOnce(
      new ExecError(`Command failed: ${secret}`, {
        cmd: 'vp sync-versions --json',
        options: {},
        stderr: secret,
        stdout: secret,
      }),
    );

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('Vite+ planner execution failed');
    expect(logger.logger.debug).toHaveBeenCalledWith(
      { workspace: '.', vitePlusVersion: '0.3.0' },
      'Vite+ planner execution failed',
    );
  });

  it('normalizes unexpected planner failures', async () => {
    const proposed = packageJson('0.3.0', '4.0.0');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': packageJson('0.2.0', '4.0.0') });
    execMock.mockRejectedValueOnce(new Error('unexpected failure'));

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('Vite+ planner execution failed');
  });

  it.each([
    new Error(TEMPORARY_ERROR),
    new ExternalHostError(new Error('registry unavailable'), 'npm'),
  ])('preserves a transient exec failure: %s', async (error) => {
    const proposed = packageJson('0.3.0', '4.0.0');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': proposed });
    execMock.mockRejectedValueOnce(error);

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toBe(error);

    expect(updateConfig.updatedPackageFiles).toEqual([
      { type: 'addition', path: 'package.json', contents: proposed },
    ]);
  });
});
