import { partial } from '~test/util.ts';
import { GlobalConfig } from '../../../../config/global.ts';
import { ExecError } from '../../../../util/exec/exec-error.ts';
import { exec } from '../../../../util/exec/index.ts';
import { getFile } from '../../../../util/git/index.ts';
import type { FileAddition } from '../../../../util/git/types.ts';
import type { PostUpdateConfig } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import type { AdditionalPackageFiles } from './types.ts';
import { reconcileVitePlusVersions } from './vite-plus.ts';

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
        depName,
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

    await reconcileVitePlusVersions(updateConfig, packageFiles());

    expect(
      additionContents(updateConfig.updatedPackageFiles?.[0] as FileAddition),
    ).toBe(aligned);
    expect(execMock).toHaveBeenCalledOnce();
    const [commands, options] = execMock.mock.calls[0];
    const execOptions = options!;
    expect(commands).toEqual([
      { command: ['vp', 'sync-versions', '--plan-json'] },
    ]);
    expect(execOptions).toMatchObject({
      docker: {},
      maxBuffer: 33 * 1024 * 1024,
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
    ).rejects.toThrow('unsupported manifest change at name');
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
    ).rejects.toThrow('unsupported manifest change at packages');
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

  it('propagates unrelated planner failures', async () => {
    const proposed = packageJson('0.3.0', '4.0.0');
    const updateConfig = config(proposed);
    mockFiles({ 'package.json': packageJson('0.2.0', '4.0.0') });
    execMock.mockRejectedValueOnce(new Error('planner crashed'));

    await expect(
      reconcileVitePlusVersions(updateConfig, packageFiles()),
    ).rejects.toThrow('planner crashed');
  });
});
