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
    fs.getSiblingFileName.mockReturnValue('buf.yaml');
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

  const pinnedDep = {
    depName: 'protocolbuffers/wellknowntypes',
    packageName: 'protocolbuffers/wellknowntypes',
    registryUrls: ['https://buf.build'],
    currentDigest: 'ba48c1a6dc7d47d0aa9940aa3601b039',
    newDigest: 'f1151727eddb493abf82a1d919dc35e4',
  };

  it('advances a commit pin in buf.yaml so the bump survives buf dep update', async () => {
    const bufYaml =
      'version: v2\ndeps:\n  - buf.build/protocolbuffers/wellknowntypes:ba48c1a6dc7d47d0aa9940aa3601b039\n';
    fs.readLocalFile.mockResolvedValueOnce('old lock'); // initial buf.lock read
    fs.readLocalFile.mockResolvedValueOnce(bufYaml); // sibling buf.yaml read
    fs.readLocalFile.mockResolvedValueOnce('new lock'); // buf.lock after buf dep update
    const execSnapshots = mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'buf.lock',
      updatedDeps: [pinnedDep],
      newPackageFileContent: 'new buf.lock',
      config,
    });

    // buf.yaml pin advanced, and committed ahead of the regenerated buf.lock.
    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'buf.yaml',
          contents:
            'version: v2\ndeps:\n  - buf.build/protocolbuffers/wellknowntypes:f1151727eddb493abf82a1d919dc35e4\n',
        },
      },
      {
        file: { type: 'addition', path: 'buf.lock', contents: 'new lock' },
      },
    ]);
    expect(fs.writeLocalFile).toHaveBeenCalledWith(
      'buf.yaml',
      'version: v2\ndeps:\n  - buf.build/protocolbuffers/wellknowntypes:f1151727eddb493abf82a1d919dc35e4\n',
    );
    expect(execSnapshots).toMatchObject([{ cmd: 'buf dep update' }]);
  });

  it('commits the advanced buf.yaml even when buf.lock is unchanged', async () => {
    const bufYaml =
      'version: v2\ndeps:\n  - buf.build/protocolbuffers/wellknowntypes:ba48c1a6dc7d47d0aa9940aa3601b039\n';
    fs.readLocalFile.mockResolvedValueOnce('same lock'); // initial buf.lock read
    fs.readLocalFile.mockResolvedValueOnce(bufYaml); // sibling buf.yaml read
    fs.readLocalFile.mockResolvedValueOnce('same lock'); // buf.lock after buf dep update
    mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'buf.lock',
      // No packageName: extract emits only depName, so the pin is built from it.
      updatedDeps: [{ ...pinnedDep, packageName: undefined }],
      newPackageFileContent: 'new buf.lock',
      config,
    });

    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'buf.yaml',
          contents:
            'version: v2\ndeps:\n  - buf.build/protocolbuffers/wellknowntypes:f1151727eddb493abf82a1d919dc35e4\n',
        },
      },
    ]);
  });

  it('leaves buf.yaml alone when it holds no matching pin', async () => {
    // Unpinned (tracks main) or a different module: no `:currentDigest` to swap.
    const bufYaml =
      'version: v2\ndeps:\n  - buf.build/protocolbuffers/wellknowntypes\n';
    fs.readLocalFile.mockResolvedValueOnce('old lock'); // initial buf.lock read
    fs.readLocalFile.mockResolvedValueOnce(bufYaml); // sibling buf.yaml read
    fs.readLocalFile.mockResolvedValueOnce('new lock'); // buf.lock after buf dep update
    mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'buf.lock',
      updatedDeps: [pinnedDep],
      newPackageFileContent: 'new buf.lock',
      config,
    });

    expect(res).toEqual([
      {
        file: { type: 'addition', path: 'buf.lock', contents: 'new lock' },
      },
    ]);
    expect(fs.writeLocalFile).not.toHaveBeenCalledWith('buf.yaml', bufYaml);
  });

  it('skips the buf.yaml read when there is no sibling file', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old lock'); // initial buf.lock read
    fs.readLocalFile.mockResolvedValueOnce(null); // sibling buf.yaml missing
    fs.readLocalFile.mockResolvedValueOnce('new lock'); // buf.lock after buf dep update
    mockExecAll();

    const res = await updateArtifacts({
      packageFileName: 'buf.lock',
      updatedDeps: [pinnedDep],
      newPackageFileContent: 'new buf.lock',
      config,
    });

    expect(res).toEqual([
      {
        file: { type: 'addition', path: 'buf.lock', contents: 'new lock' },
      },
    ]);
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
