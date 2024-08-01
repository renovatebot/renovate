import { join } from 'upath';
import {
  envMock,
  mockExecAll,
  // mockExecSequence,
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
// const dockerAdminConfig = {
//   ...adminConfig,
//   binarySource: 'docker',
//   dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
// };

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};
const updateInputCmd = `corepack use pnpm@8.15.6`;

// return null if no packageManager updates
// return null if package.json not changed
// use node version within constraints
// return null if node<16.9 used as corepack is not availale
// return error if i) command execution error ii) read package file error
// return changed package.json if all is well
// supports mode  i) docker ii) containerbase iii) install

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

  // it('supports docker mode', async () => {
  //   GlobalConfig.set(dockerAdminConfig);
  //   const execSnapshots = mockExecAll();
  //   // git.getRepoStatus.mockResolvedValue(
  //   //   partial<StatusResult>({
  //   //     modified: ['flake.lock'],
  //   //   }),
  //   // );
  //   fs.readLocalFile.mockResolvedValueOnce('new flake.lock');

  //   const res = await updateArtifacts({
  //     packageFileName: 'flake.nix',
  //     updatedDeps: [{ depName: 'nixpkgs' }],
  //     newPackageFileContent: '{}',
  //     config: { ...config, constraints: { nix: '2.10.0' } },
  //   });

  //   expect(res).toEqual([
  //     {
  //       file: {
  //         path: 'flake.lock',
  //         type: 'addition',
  //       },
  //     },
  //   ]);
  //   expect(execSnapshots).toMatchObject([
  //     { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
  //     { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
  //     {
  //       cmd:
  //         'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
  //         '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
  //         '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
  //         '-e CONTAINERBASE_CACHE_DIR ' +
  //         '-w "/tmp/github/some/repo" ' +
  //         'ghcr.io/containerbase/sidecar ' +
  //         'bash -l -c "' +
  //         'install-tool nix 2.10.0 ' +
  //         '&& ' +
  //         updateInputCmd +
  //         '"',
  //     },
  //   ]);
  // });

  // it('supports install mode', async () => {
  //   GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
  //   const execSnapshots = mockExecAll();
  //   // git.getRepoStatus.mockResolvedValue(
  //   //   partial<StatusResult>({
  //   //     modified: ['flake.lock'],
  //   //   }),
  //   // );
  //   fs.readLocalFile.mockResolvedValueOnce('new flake.lock');

  //   const res = await updateArtifacts({
  //     packageFileName: 'flake.nix',
  //     updatedDeps: [{ depName: 'nixpkgs' }],
  //     newPackageFileContent: '{}',
  //     config: { ...config, constraints: { nix: '2.10.0' } },
  //   });

  //   expect(res).toEqual([
  //     {
  //       file: {
  //         path: 'flake.lock',
  //         type: 'addition',
  //       },
  //     },
  //   ]);
  //   expect(execSnapshots).toMatchObject([
  //     { cmd: 'install-tool nix 2.10.0' },
  //     {
  //       cmd: updateInputCmd,
  //       options: { cwd: '/tmp/github/some/repo' },
  //     },
  //   ]);
  // });

  // it('catches errors', async () => {
  //   fs.readLocalFile.mockResolvedValueOnce('current flake.lock');
  //   const execSnapshots = mockExecSequence([new Error('exec error')]);

  //   const res = await updateArtifacts({
  //     packageFileName: 'flake.nix',
  //     updatedDeps: [{ depName: 'nixpkgs' }],
  //     newPackageFileContent: '{}',
  //     config,
  //   });

  //   expect(res).toEqual([
  //     {
  //       artifactError: { lockFile: 'flake.lock', stderr: 'exec error' },
  //     },
  //   ]);
  //   expect(execSnapshots).toMatchObject([{ cmd: updateInputCmd }]);
  // });

  // it('uses node from config', async () => {
  //   GlobalConfig.set(dockerAdminConfig);
  //   const execSnapshots = mockExecAll();
  //   // git.getRepoStatus.mockResolvedValue(
  //   //   partial<StatusResult>({
  //   //     modified: ['flake.lock'],
  //   //   }),
  //   // );
  //   fs.readLocalFile.mockResolvedValueOnce('new lock');

  //   const res = await updateArtifacts({
  //     packageFileName: 'flake.nix',
  //     updatedDeps: [{ depName: 'nixpkgs' }],
  //     newPackageFileContent: 'some new content',
  //     config: {
  //       ...config,
  //       constraints: { nix: '2.10.0' },
  //     },
  //   });

  //   expect(res).toEqual([
  //     {
  //       file: {
  //         path: 'flake.lock',
  //         type: 'addition',
  //       },
  //     },
  //   ]);
  //   expect(execSnapshots).toMatchObject([
  //     { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
  //     { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
  //     {
  //       cmd:
  //         'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
  //         '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
  //         '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
  //         '-e CONTAINERBASE_CACHE_DIR ' +
  //         '-w "/tmp/github/some/repo" ' +
  //         'ghcr.io/containerbase/sidecar ' +
  //         'bash -l -c "' +
  //         'install-tool nix 2.10.0 ' +
  //         '&& ' +
  //         updateInputCmd +
  //         '"',
  //     },
  //   ]);
  // });
});
