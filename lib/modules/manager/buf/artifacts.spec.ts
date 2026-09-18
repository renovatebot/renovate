import upath from 'upath';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { hostRules } from '~test/host-rules.ts';
import { env, fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { BufModuleDatasource } from '../../datasource/buf-module/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/exec/env.ts');
vi.mock('../../../util/fs/index.ts');

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  binarySource: 'global',
};

// support install mode
process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};

const googleapisDep = {
  depName: 'googleapis/googleapis',
  registryUrls: ['https://buf.build'],
};

describe('modules/manager/buf/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('ignores non-buf.lock package files (e.g. buf.gen.yaml plugins)', async () => {
    const execSnapshots = mockExecAll();
    await expect(
      updateArtifacts({
        packageFileName: 'buf.gen.yaml',
        updatedDeps: [{ depName: 'protocolbuffers/go' }],
        newPackageFileContent: 'new buf.gen.yaml',
        config,
      }),
    ).resolves.toBeNull();
    expect(execSnapshots).toEqual([]);
    expect(fs.readLocalFile).not.toHaveBeenCalled();
  });

  it('returns null if no updated deps and not lockFileMaintenance', async () => {
    await expect(
      updateArtifacts({
        packageFileName: 'buf.lock',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).resolves.toBeNull();
  });

  it('returns null if buf.lock cannot be read', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    await expect(
      updateArtifacts({
        packageFileName: 'buf.lock',
        updatedDeps: [googleapisDep],
        newPackageFileContent: '',
        config,
      }),
    ).resolves.toBeNull();
  });

  it('returns null when the lock file is unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old lock');
    fs.readLocalFile.mockResolvedValueOnce('old lock');
    const execSnapshots = mockExecAll();
    await expect(
      updateArtifacts({
        packageFileName: 'buf.lock',
        updatedDeps: [googleapisDep],
        newPackageFileContent: 'new buf.lock',
        config,
      }),
    ).resolves.toBeNull();
    expect(fs.writeLocalFile).toHaveBeenCalledWith('buf.lock', 'new buf.lock');
    expect(execSnapshots).toMatchObject([
      { cmd: 'buf dep update', options: { cwd: '/tmp/github/some/repo' } },
    ]);
  });

  it('returns null when the lock file disappears after running', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old lock');
    fs.readLocalFile.mockResolvedValueOnce(null);
    const execSnapshots = mockExecAll();
    await expect(
      updateArtifacts({
        packageFileName: 'buf.lock',
        // a dep with no registryUrls exercises the token-collection fallback
        updatedDeps: [{ depName: 'googleapis/googleapis' }],
        newPackageFileContent: 'buf.lock',
        config,
      }),
    ).resolves.toBeNull();
    expect(execSnapshots[0].options?.env).not.toHaveProperty('BUF_TOKEN');
  });

  it('regenerates and returns the updated buf.lock', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old lock');
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    const execSnapshots = mockExecAll();
    const res = await updateArtifacts({
      packageFileName: 'buf.lock',
      updatedDeps: [googleapisDep],
      newPackageFileContent: 'new buf.lock',
      config,
    });
    expect(res).toEqual([
      {
        file: { type: 'addition', path: 'buf.lock', contents: 'new lock' },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'buf dep update' }]);
  });

  it('supports lockFileMaintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old lock');
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    mockExecAll();
    const res = await updateArtifacts({
      packageFileName: 'buf.lock',
      updatedDeps: [],
      newPackageFileContent: 'buf.lock',
      config: { ...config, isLockFileMaintenance: true },
    });
    expect(res).toEqual([
      {
        file: { type: 'addition', path: 'buf.lock', contents: 'new lock' },
      },
    ]);
  });

  it('injects BUF_TOKEN from host rules', async () => {
    hostRules.add({
      hostType: BufModuleDatasource.id,
      matchHost: 'buf.build',
      token: 'secret',
    });
    fs.readLocalFile.mockResolvedValueOnce('old lock');
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    const execSnapshots = mockExecAll();
    await updateArtifacts({
      packageFileName: 'buf.lock',
      updatedDeps: [googleapisDep],
      newPackageFileContent: 'buf.lock',
      config,
    });
    expect(execSnapshots[0].options?.env).toMatchObject({
      BUF_TOKEN: 'secret@buf.build',
    });
  });

  it('injects BUF_TOKEN for a self-hosted BSR host', async () => {
    hostRules.add({
      hostType: BufModuleDatasource.id,
      matchHost: 'bsr.example.com',
      token: 'private',
    });
    fs.readLocalFile.mockResolvedValueOnce('old lock');
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    const execSnapshots = mockExecAll();
    await updateArtifacts({
      packageFileName: 'buf.lock',
      updatedDeps: [
        {
          depName: 'acme/weather',
          registryUrls: ['https://bsr.example.com'],
        },
      ],
      newPackageFileContent: 'buf.lock',
      config,
    });
    expect(execSnapshots[0].options?.env).toMatchObject({
      BUF_TOKEN: 'private@bsr.example.com',
    });
  });

  it('joins BUF_TOKEN entries across multiple registries', async () => {
    hostRules.add({
      hostType: BufModuleDatasource.id,
      matchHost: 'buf.build',
      token: 'public',
    });
    hostRules.add({
      hostType: BufModuleDatasource.id,
      matchHost: 'bsr.example.com',
      token: 'private',
    });
    fs.readLocalFile.mockResolvedValueOnce('old lock');
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    const execSnapshots = mockExecAll();
    await updateArtifacts({
      packageFileName: 'buf.lock',
      updatedDeps: [
        googleapisDep,
        {
          depName: 'acme/weather',
          registryUrls: ['https://bsr.example.com'],
        },
      ],
      newPackageFileContent: 'buf.lock',
      config,
    });
    expect(execSnapshots[0].options?.env).toMatchObject({
      BUF_TOKEN: 'public@buf.build,private@bsr.example.com',
    });
  });

  it('returns an artifact error when buf fails', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old lock');
    mockExecAll(new Error('buf exploded'));
    const res = await updateArtifacts({
      packageFileName: 'buf.lock',
      updatedDeps: [googleapisDep],
      newPackageFileContent: 'buf.lock',
      config,
    });
    expect(res).toEqual([
      {
        artifactError: { fileName: 'buf.lock', stderr: 'buf exploded' },
      },
    ]);
  });
});
