import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { git, mocked } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import * as _datasource from '../../datasource';
import * as _env from '../../util/exec/env';
import type { StatusResult } from '../../util/git/types';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';
import * as fsutil from '../../util/fs';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/git');
jest.mock('../../platform');
jest.mock('../../datasource');
jest.mock('../../util/fs', () => {
  const originalModule = jest.requireActual('../../util/fs');

  return {
    __esModule: true,
    ...originalModule,
    readLocalFile: jest.fn(),
  };
});

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const datasource = mocked(_datasource);
const readLocalFile = mocked(fsutil.readLocalFile);

delete process.env.CP_HOME_DIR;

const config: UpdateArtifactsConfig = {};

const adminConfig: RepoGlobalConfig = {
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
};

describe('manager/cocoapods/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);

    GlobalConfig.set(adminConfig);

    datasource.getPkgReleases.mockResolvedValue({
      releases: [
        { version: '1.2.0' },
        { version: '1.2.1' },
        { version: '1.2.2' },
        { version: '1.2.3' },
        { version: '1.2.4' },
        { version: '1.2.5' },
      ],
    });
  });
  afterEach(() => {
    GlobalConfig.reset();
  });
  it('returns null if no Podfile.lock found', async () => {
    const execSnapshots = mockExecAll(exec);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns null if no updatedDeps were provided', async () => {
    const execSnapshots = mockExecAll(exec);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns null for invalid local directory', async () => {
    const execSnapshots = mockExecAll(exec);
    GlobalConfig.set({
      localDir: '',
    });

    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config: {},
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns null if updatedDeps is empty', async () => {
    const execSnapshots = mockExecAll(exec);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns null if unchanged', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockResolvedValueOnce('Current Podfile' as any);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: [],
    } as StatusResult);
    readLocalFile.mockResolvedValueOnce('Current Podfile' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated Podfile', async () => {
    const execSnapshots = mockExecAll(exec);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    readLocalFile.mockResolvedValueOnce('Old Podfile' as any);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Podfile.lock'],
    } as StatusResult);
    readLocalFile.mockResolvedValueOnce('New Podfile' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: 'plugin "cocoapods-acknowledgements"',
        config,
      })
    ).toMatchSnapshot([{ file: { contents: 'New Podfile' } }]);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated Podfile and Pods files', async () => {
    const execSnapshots = mockExecAll(exec);
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    readLocalFile.mockResolvedValueOnce('Old Manifest.lock' as any);
    readLocalFile.mockResolvedValueOnce('New Podfile' as any);
    readLocalFile.mockResolvedValueOnce('Pods manifest' as any);
    git.getRepoStatus.mockResolvedValueOnce({
      not_added: ['Pods/New'],
      modified: ['Podfile.lock', 'Pods/Manifest.lock'],
      deleted: ['Pods/Deleted'],
    } as StatusResult);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toMatchSnapshot([
      { file: { name: 'Podfile.lock' } },
      { file: { name: 'Pods/Manifest.lock' } },
      { file: { name: 'Pods/New' } },
      { file: { name: '|delete|' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches write error', async () => {
    const execSnapshots = mockExecAll(exec);
    readLocalFile.mockResolvedValueOnce('Current Podfile' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: 'Podfile.lock', stderr: 'not found' } },
    ]);
    expect(execSnapshots).toBeEmpty();
  });
  it('returns pod exec error', async () => {
    const execSnapshots = mockExecAll(exec, new Error('exec exception'));
    readLocalFile.mockResolvedValueOnce('Old Podfile.lock' as any);
    fs.outputFile.mockResolvedValueOnce(null as never);
    readLocalFile.mockResolvedValueOnce('Old Podfile.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Podfile',
        updatedDeps: [{ depName: 'foo' }],
        newPackageFileContent: '',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: 'Podfile.lock', stderr: 'exec exception' } },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
  it('dynamically selects Docker image tag', async () => {
    const execSnapshots = mockExecAll(exec);

    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });

    readLocalFile.mockResolvedValueOnce('COCOAPODS: 1.2.4' as any);

    readLocalFile.mockResolvedValueOnce('New Podfile' as any);

    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Podfile.lock'],
    } as StatusResult);

    await updateArtifacts({
      packageFileName: 'Podfile',
      updatedDeps: [{ depName: 'foo' }],
      newPackageFileContent: '',
      config,
    });
    expect(execSnapshots).toMatchSnapshot([
      { cmd: 'docker pull renovate/cocoapods:1.2.4' },
      {},
      {},
    ]);
  });
  it('falls back to the `latest` Docker image tag', async () => {
    const execSnapshots = mockExecAll(exec);

    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });

    readLocalFile.mockResolvedValueOnce('COCOAPODS: 1.2.4' as any);
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [],
    });

    readLocalFile.mockResolvedValueOnce('New Podfile' as any);

    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['Podfile.lock'],
    } as StatusResult);

    await updateArtifacts({
      packageFileName: 'Podfile',
      updatedDeps: [{ depName: 'foo' }],
      newPackageFileContent: '',
      config,
    });
    expect(execSnapshots).toMatchSnapshot([
      { cmd: 'docker pull renovate/cocoapods:latest' },
      {},
      {},
    ]);
  });
});
