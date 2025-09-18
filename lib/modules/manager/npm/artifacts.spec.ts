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
});
