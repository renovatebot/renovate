import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { UpdateArtifactsConfig, Upgrade } from '../types';
import * as rules from './post-update/rules';
import { updateArtifacts } from '.';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util';
import { env, fs } from '~test/util';

vi.mock('../../../util/exec/env');
vi.mock('../../../util/fs');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/renovate/cache'),
  containerbaseDir: upath.join('/tmp/renovate/cache/containerbase'),
};
const dockerAdminConfig = {
  ...adminConfig,
  binarySource: 'docker',
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

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
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar ' +
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

  describe('Node.js engines.node updates', () => {
    it('updates engines.node when .nvmrc is present with newer version', async () => {
      const packageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '>=20.0.0' },
      });
      const updatedPackageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '>=22.19.0' },
      });

      fs.readLocalFile.mockResolvedValueOnce('22.19.0\n'); // .nvmrc read

      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [],
        newPackageFileContent: packageJsonContent,
        config,
      });

      expect(res).toEqual([
        {
          file: {
            contents: updatedPackageJsonContent,
            path: 'package.json',
            type: 'addition',
          },
        },
      ]);
    });

    it('updates engines.node when .node-version is present with newer version', async () => {
      const packageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '>=20.0.0' },
      });
      const updatedPackageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '>=22.19.0' },
      });

      fs.readLocalFile
        .mockResolvedValueOnce(null) // .nvmrc read (not found)
        .mockResolvedValueOnce('22.19.0\n'); // .node-version read

      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [],
        newPackageFileContent: packageJsonContent,
        config,
      });

      expect(res).toEqual([
        {
          file: {
            contents: updatedPackageJsonContent,
            path: 'package.json',
            type: 'addition',
          },
        },
      ]);
    });

    it('preserves constraint format when updating engines.node', async () => {
      const packageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '^20.0.0' },
      });
      const updatedPackageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '>=22.19.0' },
      });

      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('22.19.0\n');

      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [],
        newPackageFileContent: packageJsonContent,
        config,
      });

      expect(res).toEqual([
        {
          file: {
            contents: updatedPackageJsonContent,
            path: 'package.json',
            type: 'addition',
          },
        },
      ]);
    });

    it('does not update if engines.node does not exist', async () => {
      const packageJsonContent = JSON.stringify({
        name: 'test',
      });

      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('22.19.0\n');

      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [],
        newPackageFileContent: packageJsonContent,
        config,
      });

      expect(res).toBeNull();
    });

    it('does not update if versions are the same', async () => {
      const packageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '>=22.19.0' },
      });

      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('22.19.0\n');

      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [],
        newPackageFileContent: packageJsonContent,
        config,
      });

      // Should return null because no update is needed
      expect(res).toBeNull();
    });

    it('does not update if .nvmrc and .node-version do not exist', async () => {
      const packageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '>=20.0.0' },
      });

      fs.readLocalFile
        .mockResolvedValueOnce(null) // .nvmrc
        .mockResolvedValueOnce(null); // .node-version

      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [],
        newPackageFileContent: packageJsonContent,
        config,
      });

      expect(res).toBeNull();
    });

    it('handles errors gracefully when checking Node.js version files', async () => {
      const packageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '>=20.0.0' },
      });

      fs.readLocalFile.mockRejectedValueOnce(new Error('File read error'));

      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [],
        newPackageFileContent: packageJsonContent,
        config,
      });

      // Should return null, not throw
      expect(res).toBeNull();
    });

    it('updates engines.node when both packageManager and Node.js updates are present', async () => {
      const packageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '>=20.0.0' },
        packageManager:
          'pnpm@8.15.5+sha256.4b4efa12490e5055d59b9b9fc9438b7d581a6b7af3b5675eb5c5f447cee1a589',
      });
      const updatedPackageJsonContent = JSON.stringify({
        name: 'test',
        engines: { node: '>=22.19.0' },
        packageManager: 'pnpm@8.15.6+sha256.newhash',
      });

      fs.readLocalFile
        .mockResolvedValueOnce('# dummy') // for npmrc
        .mockResolvedValueOnce('{}') // for node constraints
        .mockResolvedValueOnce(updatedPackageJsonContent) // after corepack
        .mockResolvedValueOnce(null) // .nvmrc
        .mockResolvedValueOnce('22.19.0\n'); // .node-version

      const execSnapshots = mockExecAll();

      const res = await updateArtifacts({
        packageFileName: 'package.json',
        updatedDeps: [validDepUpdate],
        newPackageFileContent: packageJsonContent,
        config: { ...config },
      });

      expect(res).toBeDefined();
      expect(execSnapshots).toMatchObject([
        { cmd: 'corepack use pnpm@8.15.6' },
      ]);
    });
  });
});
