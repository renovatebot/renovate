import { codeBlock } from 'common-tags';
import upath from 'upath';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { env, fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { FileAddition } from '../../../util/git/types.ts';
import type { UpdateArtifactsConfig, Upgrade } from '../types.ts';
import { updateArtifacts } from './index.ts';
import * as rules from './post-update/rules.ts';

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');

const adminConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
  binarySource: 'global',
} satisfies RepoGlobalConfig & InternalGlobalConfigOptions;
const dockerAdminConfig = {
  ...adminConfig,
  binarySource: 'docker',
  dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
} satisfies RepoGlobalConfig;

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};
const validDepUpdate = {
  depName: 'pnpm',
  depType: 'packageManager',
  currentValue:
    '8.15.5+sha256.4b4efa12490e5055d59b9b9fc9438b7d581a6b7af3b5675eb5c5f447cee1a589',
  newVersion: '8.15.6',
} satisfies Upgrade<Record<string, unknown>>;
const generatedVersion =
  '8.15.6+sha256.9d96d150c8a4659f375e954128f4f03f21bf7c67a5ea6c22e65f47e3d0f9f744';

describe('modules/manager/npm/artifacts', () => {
  const spyProcessHostRules = vi.spyOn(rules, 'processHostRules');

  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
    spyProcessHostRules.mockReturnValue({
      additionalNpmrcContent: [],
      additionalYarnRcYml: undefined,
    });
    fs.privateCacheDir.mockReturnValue(
      upath.join(adminConfig.cacheDir, '__renovate-private-cache'),
    );
  });

  it('returns null if no packageManager updates present', async () => {
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ ...validDepUpdate, depName: 'xmldoc', depType: 'patch' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
  });

  it('returns null if currentValue is undefined', async () => {
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ ...validDepUpdate, currentValue: undefined }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
  });

  it('returns null if currentValue has no hash', async () => {
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ ...validDepUpdate, currentValue: '8.15.5' }],
      newPackageFileContent: 'some new content',
      config,
    });

    expect(res).toBeNull();
  });

  it('returns null if unchanged', async () => {
    const packageFileContent = JSON.stringify({
      packageManager: `pnpm@${generatedVersion}`,
    });
    fs.readLocalFile.mockResolvedValue(packageFileContent);
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: packageFileContent,
      config: { ...config },
    });

    expect(res).toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: 'corepack use pnpm@8.15.6' }]);
  });

  it('returns updated package.json', async () => {
    const corepackPackageFileContent = JSON.stringify({
      packageManager: `pnpm@${generatedVersion}`,
    });
    fs.readLocalFile.mockResolvedValue(corepackPackageFileContent);
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'some content',
      config: { ...config },
    });

    expect(res).toEqual([
      {
        file: {
          contents: corepackPackageFileContent,
          path: 'package.json',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'corepack use pnpm@8.15.6' }]);
  });

  it('quotes the corepack package spec', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // for npmrc
      .mockResolvedValueOnce('{}') // for node constraints
      .mockResolvedValue('some new content'); // for updated package.json
    const execSnapshots = mockExecAll();

    await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        {
          ...validDepUpdate,
          depName: 'pnpm; echo hello',
        },
      ],
      newPackageFileContent: 'some content',
      config: { ...config },
    });

    expect(execSnapshots).toMatchObject([
      { cmd: `corepack use 'pnpm; echo hello@8.15.6'` },
    ]);
  });

  it('preserves a Corepack hash in devEngines.packageManager', async () => {
    const packageFileContent = JSON.stringify(
      {
        devEngines: {
          packageManager: {
            name: 'pnpm',
            version: '8.15.6',
            onFail: 'error',
          },
        },
      },
      null,
      2,
    );
    const corepackPackageFileContent = JSON.stringify({
      private: true,
      packageManager: `pnpm@${generatedVersion}`,
    });
    spyProcessHostRules.mockReturnValue({
      additionalNpmrcContent: ['//registry.example/:_authToken=token'],
      additionalYarnRcYml: undefined,
    });
    fs.readLocalFile.mockImplementation((fileName) =>
      Promise.resolve(
        fileName.endsWith('.npmrc')
          ? 'registry=https://registry.example'
          : null,
      ),
    );
    fs.readCacheFile.mockResolvedValue(corepackPackageFileContent);
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        {
          ...validDepUpdate,
          depType: 'devEngines.packageManager',
        },
      ],
      newPackageFileContent: packageFileContent,
      config,
    });

    const contents = (res![0].file as FileAddition).contents?.toString();
    expect(contents).toBeJsonString();
    expect(JSON.parse(contents!)).toEqual({
      devEngines: {
        packageManager: {
          name: 'pnpm',
          version: generatedVersion,
          onFail: 'error',
        },
      },
    });
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'corepack use pnpm@8.15.6',
        options: {
          cwd: expect.stringContaining(
            '/__renovate-private-cache/npm-corepack/',
          ),
        },
      },
    ]);
    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      expect.stringMatching(/\/npm-corepack\/.*\/package\.json$/),
      JSON.stringify({ private: true }),
    );
    expect(fs.outputCacheFile).toHaveBeenCalledWith(
      expect.stringMatching(/\/npm-corepack\/.*\/\.npmrc$/),
      'registry=https://registry.example\n//registry.example/:_authToken=token\n',
    );
    expect(fs.rmCache).toHaveBeenCalledWith(
      expect.stringContaining('/__renovate-private-cache/npm-corepack/'),
    );
  });

  it('preserves Corepack hashes in a devEngines.packageManager array', async () => {
    const yarnVersion =
      '4.6.0+sha256.29b03c4fdc4c1a4e75a11d8d53cb7e0b27fd3a92cdf6a81973a8f00ec9e21757';
    const packageFileContent = JSON.stringify({
      devEngines: {
        packageManager: [
          { name: 'pnpm', version: '8.15.6' },
          { name: 'yarn', version: '4.6.0' },
        ],
      },
    });
    const execSnapshots = mockExecAll();
    fs.readCacheFile.mockImplementation(() => {
      const corepackExecCount = execSnapshots.filter(({ cmd }) =>
        cmd.startsWith('corepack use'),
      ).length;
      const packageManager =
        corepackExecCount === 1
          ? `pnpm@${generatedVersion}`
          : `yarn@${yarnVersion}`;
      return Promise.resolve(
        JSON.stringify({
          private: true,
          packageManager,
        }),
      );
    });

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        {
          ...validDepUpdate,
          depType: 'devEngines.packageManager',
          managerData: { devEnginesIndex: 0 },
        },
        {
          depName: 'yarn',
          depType: 'devEngines.packageManager',
          currentValue:
            '4.5.0+sha256.b3d75458d50d51567d44cdd8b2f9d59a2e2f3b6c60ac21884e8805f2755c1b40',
          newVersion: '4.6.0',
          managerData: { devEnginesIndex: 1 },
        },
      ],
      newPackageFileContent: packageFileContent,
      config,
    });

    const contents = (res![0].file as FileAddition).contents?.toString();
    expect(contents).toBeJsonString();
    expect(JSON.parse(contents!)).toEqual({
      devEngines: {
        packageManager: [
          { name: 'pnpm', version: generatedVersion },
          { name: 'yarn', version: yarnVersion },
        ],
      },
    });
    expect(execSnapshots).toMatchObject([
      { cmd: 'corepack use pnpm@8.15.6' },
      { cmd: 'corepack use yarn@4.6.0' },
    ]);
    const firstCwd = execSnapshots[0]?.options?.cwd;
    const secondCwd = execSnapshots[1]?.options?.cwd;
    expect(firstCwd).toEqual(expect.any(String));
    expect(firstCwd).toBe(secondCwd);
  });

  it.each([
    {
      firstDepType: 'devEngines.packageManager',
      packageManagerFirst: false,
    },
    { firstDepType: 'packageManager', packageManagerFirst: true },
  ])(
    'reuses a generated hash with $firstDepType first',
    async ({ packageManagerFirst }) => {
      const packageFileContent = JSON.stringify({
        packageManager: 'pnpm@8.15.6',
        devEngines: {
          packageManager: { name: 'pnpm', version: '8.15.6' },
        },
      });
      const corepackPackageFileContent = JSON.stringify({
        ...JSON.parse(packageFileContent),
        packageManager: `pnpm@${generatedVersion}`,
      });
      fs.readLocalFile.mockResolvedValue(corepackPackageFileContent);
      const execSnapshots = mockExecAll();
      const devEnginesUpdate = {
        ...validDepUpdate,
        depType: 'devEngines.packageManager',
      };

      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: packageManagerFirst
          ? [validDepUpdate, devEnginesUpdate]
          : [devEnginesUpdate, validDepUpdate],
        newPackageFileContent: packageFileContent,
        config,
      });

      const contents = (res![0].file as FileAddition).contents?.toString();
      expect(contents).toBeJsonString();
      expect(JSON.parse(contents!)).toEqual({
        packageManager: `pnpm@${generatedVersion}`,
        devEngines: {
          packageManager: { name: 'pnpm', version: generatedVersion },
        },
      });
      expect(execSnapshots).toMatchObject([
        { cmd: 'corepack use pnpm@8.15.6' },
      ]);
    },
  );

  it.each([
    ['invalid JSON', 'not json'],
    ['a missing package file', null],
    ['a missing packageManager', '{}'],
    [
      'a different package manager',
      JSON.stringify({ packageManager: `yarn@${generatedVersion}` }),
    ],
    [
      'a version without a hash',
      JSON.stringify({ packageManager: 'pnpm@8.15.6' }),
    ],
  ])(
    'returns an artifact error if Corepack generates %s',
    async (_, output) => {
      fs.readLocalFile.mockResolvedValue(output);
      mockExecAll();

      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [validDepUpdate],
        newPackageFileContent: JSON.stringify({
          packageManager: 'pnpm@8.15.6',
        }),
        config,
      });

      expect(res).toEqual([
        {
          artifactError: {
            fileName: 'package.json',
            stderr: 'Corepack did not generate a hash for pnpm@8.15.6',
          },
        },
      ]);
    },
  );

  it('returns an artifact error if the generated hash cannot be applied', async () => {
    fs.readCacheFile.mockResolvedValue(
      JSON.stringify({ packageManager: `pnpm@${generatedVersion}` }),
    );
    mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        {
          ...validDepUpdate,
          depType: 'devEngines.packageManager',
        },
      ],
      newPackageFileContent: JSON.stringify({ name: 'demo' }),
      config,
    });

    expect(res).toEqual([
      {
        artifactError: {
          fileName: 'package.json',
          stderr: 'Failed to apply Corepack hash for pnpm@8.15.6',
        },
      },
    ]);
  });

  it('cleans up the isolated project if Corepack fails', async () => {
    mockExecSequence([new Error('exec error')]);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        {
          ...validDepUpdate,
          depType: 'devEngines.packageManager',
        },
      ],
      newPackageFileContent: JSON.stringify({
        devEngines: {
          packageManager: { name: 'pnpm', version: '8.15.6' },
        },
      }),
      config,
    });

    expect(res).toEqual([
      {
        artifactError: { fileName: 'package.json', stderr: 'exec error' },
      },
    ]);
    expect(fs.rmCache).toHaveBeenCalledWith(
      expect.stringContaining('/__renovate-private-cache/npm-corepack/'),
    );
  });

  it('supports docker mode', async () => {
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll();
    const corepackPackageFileContent = JSON.stringify({
      packageManager: `pnpm@${generatedVersion}`,
    });
    fs.readLocalFile.mockResolvedValue(corepackPackageFileContent);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'some content',
      config: {
        ...config,
        constraints: { node: '20.1.0', corepack: '0.29.3' },
      },
    });

    expect(res).toEqual([
      {
        file: {
          contents: corepackPackageFileContent,
          path: 'package.json',
          type: 'addition',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e CI ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/renovatebot/base-image ' +
          "bash -l -c '" +
          'install-tool node 20.1.0 ' +
          '&& ' +
          'install-tool corepack 0.29.3 ' +
          '&& ' +
          'corepack use pnpm@8.15.6' +
          "'",
      },
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    const execSnapshots = mockExecAll();
    const corepackPackageFileContent = JSON.stringify({
      packageManager: `pnpm@${generatedVersion}`,
    });
    fs.readLocalFile.mockResolvedValue(corepackPackageFileContent);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'some content',
      config: {
        ...config,
        constraints: { node: '20.1.0', corepack: '0.29.3' },
      },
    });

    expect(res).toEqual([
      {
        file: {
          contents: corepackPackageFileContent,
          path: 'package.json',
          type: 'addition',
        },
      },
    ]);

    expect(execSnapshots).toMatchObject([
      {
        cmd: 'install-tool node 20.1.0',
        options: { cwd: '/tmp/github/some/repo' },
      },
      { cmd: 'install-tool corepack 0.29.3' },

      {
        cmd: 'corepack use pnpm@8.15.6',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecSequence([new Error('exec error')]);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'some content',
      config: {
        ...config,
        constraints: { node: '20.1.0', corepack: '0.29.3' },
      },
    });

    expect(res).toEqual([
      {
        artifactError: { fileName: 'package.json', stderr: 'exec error' },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'corepack use pnpm@8.15.6' }]);
  });

  describe('updatePnpmWorkspace()', () => {
    it('returns null if no security updates are found', async () => {
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [{ ...validDepUpdate, currentValue: '8.15.5' }],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('returns null if pnpm workspace file does not exist', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(false);
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('returns null if the pnpmLockFile file is not found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      );
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: {
              // to be super explicit it's not set
              pnpmLockFile: undefined,

              // data from testing in https://github.com/JamieTanna-Mend-testing/pnpm-test-mra-no-workspace/pull/3
              hasPackageManager: false,
              npmrcFileName: null,
              yarnZeroInstall: false,
            },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('returns null if no minimumReleaseAge setting found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(''); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('returns null if minimumReleaseAgeExclude excludes all versions of updated dep', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - '@myorg/*'
  - pnpm`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
          {
            ...validDepUpdate,
            depName: '@myorg/fs-alternative',
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('updates pnpm workspace - adds minimumReleaseAgeExclude block if not found', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: pnpm@8.15.6\n  - pnpm@8.15.6\n',
          },
        },
      ]);
    });

    it('updates pnpm workspace - appends new minimumReleaseAgeExclude setting', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - otherdep@5.6.7`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  - otherdep@5.6.7\n  # Renovate security update: pnpm@8.15.6\n  - pnpm@8.15.6\n',
          },
        },
      ]);
    });

    it('updates pnpm workspace - expands existing minimumReleaseAgeExclude setting', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - pnpm@5.6.7
  - '@next/env@16.0.7 || 16.0.9'`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            currentValue: '8.15.5',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
          {
            ...validDepUpdate,
            depName: '@next/env',
            depType: 'dependency',
            currentValue: '16.0.9',
            newVersion: '16.0.10',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              "minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: pnpm@8.15.6\n  - pnpm@5.6.7 || 8.15.6\n  # Renovate security update: @next/env@16.0.10\n  - '@next/env@16.0.7 || 16.0.9 || 16.0.10'\n",
          },
        },
      ]);
    });

    it('updates pnpm workspace - handles comment with version already present on an inner minimumReleaseAgeExclude setting', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - pnpm@5.6.7
  # Renovate security update: lodash@4.17.21 || 4.17.23
  - lodash@4.17.23`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'devDependencies',
            currentValue: '^4.17.15',
            currentVersion: '4.17.21',
            newVersion: '4.17.23',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      // no changes needed
      expect(res).toBeNull();
    });

    it('updates pnpm workspace - handles comment on an inner minimumReleaseAgeExclude setting', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080
minimumReleaseAgeExclude:
  - pnpm@5.6.7
  # Renovate security update: lodash@4.17.21
  - lodash@4.17.21`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'devDependencies',
            currentValue: '^4.17.15',
            currentVersion: '4.17.21',
            newVersion: '4.17.23',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  - pnpm@5.6.7\n  # Renovate security update: lodash@4.17.21 || 4.17.23\n  - lodash@4.17.21 || 4.17.23\n',
          },
        },
      ]);
    });

    // As per https://github.com/renovatebot/renovate/issues/40610, we don't want to allow version constraints with i.e. a caret like `^4.17.15`
    it('updates pnpm workspace - uses newVersion over newValue in minimumReleaseAgeExclude', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'devDependencies',
            currentValue: '^4.17.15',
            currentVersion: '4.17.21',
            newVersion: '4.17.23',
            newValue: '^4.17.15',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: lodash@4.17.23\n  - lodash@4.17.23\n',
          },
        },
      ]);
    });

    it('handles multiple security upgrades of the same package (at different versions) in a monorepo', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);

      // for the first package file
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      ); // for pnpm-workspace.yaml
      let res = await updateArtifacts({
        packageFileName: 'packages/a/package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'dependencies',
            currentValue: '4.17.20',
            newVersion: '4.17.21',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: lodash@4.17.21\n  - lodash@4.17.21\n',
          },
        },
      ]);
      expect(res).not.toBeNull();

      const addition = res![0].file as FileAddition;
      const newContents = addition.contents as string;

      // then for the next update
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(newContents); // for pnpm-workspace.yaml

      res = await updateArtifacts({
        packageFileName: 'packages/b/package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'devDependencies',
            currentValue: '4.17.20',
            newVersion: '4.17.23',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: lodash@4.17.21 || 4.17.23\n  - lodash@4.17.21 || 4.17.23\n',
          },
        },
      ]);
    });

    it('handles multiple security upgrades of the same package (at the same version) in a monorepo', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);

      // for the first package file
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      ); // for pnpm-workspace.yaml
      let res = await updateArtifacts({
        packageFileName: 'packages/a/package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'dependencies',
            currentValue: '4.17.20',
            newVersion: '4.17.21',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: lodash@4.17.21\n  - lodash@4.17.21\n',
          },
        },
      ]);
      expect(res).not.toBeNull();

      const addition = res![0].file as FileAddition;
      const newContents = addition.contents as string;

      // then for the next update
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(newContents); // for pnpm-workspace.yaml

      res = await updateArtifacts({
        packageFileName: 'packages/b/package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            depType: 'devDependencies',
            currentValue: '4.17.20',
            newVersion: '4.17.21',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      // no updates are needed, as they're at the same version
      expect(res).toBeNull();
    });

    it('replaces malformed minimumReleaseAgeExclude entries from prior Renovate bug', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 4320
minimumReleaseAgeExclude:
  - fast-xml-parser@<=5.3.5@5.5.7`,
      );
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'fast-xml-parser@<=5.3.5',
            packageName: 'fast-xml-parser',
            depType: 'pnpm.overrides',
            currentValue: '5.3.5',
            newVersion: '5.5.7',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents: `${codeBlock`
              minimumReleaseAge: 4320
              minimumReleaseAgeExclude:
                # Renovate security update: fast-xml-parser@5.5.7
                - fast-xml-parser@5.5.7
            `}\n`,
          },
        },
      ]);
    });

    it('appends to valid minimumReleaseAgeExclude when malformed entry also exists', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 4320
minimumReleaseAgeExclude:
  - fast-xml-parser@5.5.6
  - fast-xml-parser@<=5.3.5@5.5.7`,
      );
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'fast-xml-parser@<=5.3.5',
            packageName: 'fast-xml-parser',
            depType: 'pnpm.overrides',
            currentValue: '5.5.6',
            newVersion: '5.5.7',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents: `${codeBlock`
              minimumReleaseAge: 4320
              minimumReleaseAgeExclude:
                # Renovate security update: fast-xml-parser@5.5.7
                - fast-xml-parser@5.5.6 || 5.5.7
            `}\n`,
          },
        },
      ]);
    });

    it('uses packageName (bare package name) for pnpm overrides with range selectors', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 4320`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'fast-xml-parser@<=5.3.5',
            packageName: 'fast-xml-parser',
            depType: 'pnpm.overrides',
            currentValue: '5.3.5',
            newVersion: '5.5.7',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents: `${codeBlock`
              minimumReleaseAge: 4320
              minimumReleaseAgeExclude:
                # Renovate security update: fast-xml-parser@5.5.7
                - fast-xml-parser@5.5.7
            `}\n`,
          },
        },
      ]);
    });

    it('preserves catalog changes in pnpm-workspace.yaml when adding minimumReleaseAgeExclude', async () => {
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`
          minimumReleaseAge: 10080
          catalog:
            effect: ^3.19.0`,
      );
      const newPackageFileContent = codeBlock`
        minimumReleaseAge: 10080
        catalog:
          effect: ^3.20.0`;
      const res = await updateArtifacts({
        packageFileName: 'pnpm-workspace.yaml',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'effect',
            depType: 'pnpm.catalog.default',
            currentValue: '^3.19.0',
            newVersion: '3.20.0',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent,
        config,
      });
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\ncatalog:\n  effect: ^3.20.0\nminimumReleaseAgeExclude:\n  # Renovate security update: effect@3.20.0\n  - effect@3.20.0\n',
          },
        },
      ]);
    });

    it('handles multiple security upgrades correctly (bug fix test)', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('pnpm-workspace.yaml');
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(
        codeBlock`minimumReleaseAge: 10080`,
      ); // for pnpm-workspace.yaml
      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [
          {
            ...validDepUpdate,
            depName: 'lodash',
            currentValue: '4.17.20',
            newVersion: '4.17.21',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
          {
            ...validDepUpdate,
            depName: 'axios',
            currentValue: '0.21.0',
            newVersion: '0.21.1',
            managerData: { pnpmLockFile: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      // Both upgrades should be present - this confirms the oldContent bug fix
      expect(res).toStrictEqual([
        {
          file: {
            type: 'addition',
            path: 'pnpm-workspace.yaml',
            contents:
              'minimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  # Renovate security update: lodash@4.17.21\n  - lodash@4.17.21\n  # Renovate security update: axios@0.21.1\n  - axios@0.21.1\n',
          },
        },
      ]);
    });
  });
});
