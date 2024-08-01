import { join } from 'upath';
import {
  envMock,
  mockExecAll,
  mockExecSequence,
} from '../../../../test/exec-util';
import { env, fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as docker from '../../../util/exec/docker';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};
const dockerAdminConfig = {
  ...adminConfig,
  binarySource: 'docker',
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};
const updateInputCmd = `corepack use pnpm@8.15.6`;

describe('modules/manager/npm/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  it('returns null if no packageManager updates present', async () => {
    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'xmldoc', depType: 'patch' }],
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
      updatedDeps: [
        { depName: 'pnpm', depType: 'packageManager', newVersion: '8.15.6' },
      ],
      newPackageFileContent: 'some content',
      config: { ...config },
    });

    expect(res).toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
  });

  it('returns updated package.json', async () => {
    fs.readLocalFile.mockResolvedValueOnce('some new content');
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        { depName: 'pnpm', depType: 'packageManager', newVersion: '8.15.6' },
      ],
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
    expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('some new content');

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        { depName: 'pnpm', depType: 'packageManager', newVersion: '8.15.6' },
      ],
      newPackageFileContent: 'some content',
      config: { ...config, constraints: { node: '20.1.0' } },
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
          updateInputCmd +
          '"',
      },
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('some new content');

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        { depName: 'pnpm', depType: 'packageManager', newVersion: '8.15.6' },
      ],
      newPackageFileContent: 'some content',
      config: { ...config, constraints: { node: '20.1.0' } },
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
      { cmd: 'install-tool node 20.1.0' },
      {
        cmd: updateInputCmd,
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecSequence([new Error('exec error')]);

    const res = await updateArtifacts({
      packageFileName: 'package.json',
      updatedDeps: [
        { depName: 'pnpm', depType: 'packageManager', newVersion: '8.15.6' },
      ],
      newPackageFileContent: 'some content',
      config,
    });

    expect(res).toEqual([
      {
        artifactError: { fileName: 'package.json', stderr: 'exec error' },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
  });

  it('uses node from config', async () => {
    GlobalConfig.set(dockerAdminConfig);
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('some new content');

    const res = await updateArtifacts({
      packageFileName: 'flake.nix',
      updatedDeps: [{ depName: 'nixpkgs' }],
      newPackageFileContent: 'some new content',
      config: {
        ...config,
        constraints: { nix: '2.10.0' },
      },
    });

    expect(res).toEqual([
      {
        file: {
          path: 'flake.lock',
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
          'install-tool nix 2.10.0 ' +
          '&& ' +
          updateInputCmd +
          '"',
      },
    ]);
  });
});
