import { codeBlock } from 'common-tags';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import * as docker from '../../../util/exec/docker/index.ts';
import type { FileAddition } from '../../../util/git/types.ts';
import type { UpdateArtifactsConfig, Upgrade } from '../types.ts';
import { updateArtifacts } from './index.ts';
import * as rules from './post-update/rules.ts';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util.ts';
import { env, fs } from '~test/util.ts';

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
};
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
    fs.readLocalFile.mockResolvedValueOnce('some content');
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [validDepUpdate],
      newPackageFileContent: 'some content',
      config: { ...config },
    });

    expect(res).toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: 'corepack use pnpm@8.15.6' }]);
  });

  it('returns updated package.json', async () => {
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // for npmrc
      .mockResolvedValueOnce('{}') // for node constraints
      .mockResolvedValue('some new content'); // for updated package.json
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
          contents: 'some new content',
          path: 'package.json',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'corepack use pnpm@8.15.6' }]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll();
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // for npmrc
      .mockResolvedValueOnce('some new content');

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
          contents: 'some new content',
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
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/renovatebot/base-image ' +
          'bash -l -c "' +
          'install-tool node 20.1.0 ' +
          '&& ' +
          'install-tool corepack 0.29.3 ' +
          '&& ' +
          'corepack use pnpm@8.15.6' +
          '"',
      },
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    const execSnapshots = mockExecAll();
    fs.readLocalFile
      .mockResolvedValueOnce('# dummy') // for npmrc
      .mockResolvedValueOnce('some new content');

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
          contents: 'some new content',
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });

      expect(res).toBeNull();
    });

    it('returns null if the pnpmShrinkwrap file is not found', async () => {
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
              pnpmShrinkwrap: undefined,

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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
          {
            ...validDepUpdate,
            depName: '@myorg/fs-alternative',
            currentValue: '8.15.5',
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
          {
            ...validDepUpdate,
            depName: '@next/env',
            depType: 'dependency',
            currentValue: '16.0.9',
            newVersion: '16.0.10',
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
        ],
        newPackageFileContent: 'some new content',
        config,
      });
      // no updates are needed, as they're at the same version
      expect(res).toBeNull();
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
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
            isVulnerabilityAlert: true,
          },
          {
            ...validDepUpdate,
            depName: 'axios',
            currentValue: '0.21.0',
            newVersion: '0.21.1',
            managerData: { pnpmShrinkwrap: 'pnpm-lock.yaml' },
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
