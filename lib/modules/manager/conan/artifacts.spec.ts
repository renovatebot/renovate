import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { UpdateArtifactsConfig } from '../types';
import * as conan from '.';
import { envMock, mockExecAll } from '~test/exec-util';
import { env, fs } from '~test/util';

vi.mock('../../../util/exec/env');
vi.mock('../../../util/fs');

process.env.CONTAINERBASE = 'true';
const config: UpdateArtifactsConfig = {};

const adminConfig: RepoGlobalConfig = {
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

describe('modules/manager/conan/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    GlobalConfig.set(adminConfig);
  });

  it('returns null if updatedDeps are empty and lockFileMaintenance is turned off', async () => {
    expect(
      await conan.updateArtifacts({
        packageFileName: 'conanfile.py',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
    expect(logger.trace).toHaveBeenCalledWith(
      'No conan.lock dependencies to update',
    );
  });

  it('returns null if conan.lock was not found', async () => {
    const updatedDeps = [
      {
        depName: 'dep',
      },
    ];

    expect(
      await conan.updateArtifacts({
        packageFileName: 'conanfile.py',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
    expect(logger.trace).toHaveBeenCalledWith('No conan.lock found');
  });

  it('returns null if conan.lock read operation failed', async () => {
    const updatedDeps = [
      {
        depName: 'dep',
      },
    ];

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('conan.lock');

    expect(
      await conan.updateArtifacts({
        packageFileName: 'conanfile.py',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(
      'conan.lock read operation failed',
    );
  });

  it('returns null if read operation failed for new conan.lock', async () => {
    const updatedDeps = [
      {
        depName: 'dep',
      },
    ];
    const expectedInSnapshot = [
      {
        cmd: 'conan lock create conanfile.py',
      },
    ];

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('conan.lock');
    fs.readLocalFile.mockResolvedValueOnce('Original conan.lock');
    const execSnapshots = mockExecAll();

    expect(
      await conan.updateArtifacts({
        packageFileName: 'conanfile.py',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject(expectedInSnapshot);
    expect(logger.debug).toHaveBeenCalledWith(
      'New conan.lock read operation failed',
    );
  });

  it('returns null if original and updated conan.lock files are the same', async () => {
    const updatedDeps = [
      {
        depName: 'dep',
      },
    ];
    const expectedInSnapshot = [
      {
        cmd: 'conan lock create conanfile.py',
      },
    ];

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('conan.lock');
    fs.readLocalFile.mockResolvedValueOnce('Original conan.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Original conan.lock');

    expect(
      await conan.updateArtifacts({
        packageFileName: 'conanfile.py',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject(expectedInSnapshot);
    expect(logger.trace).toHaveBeenCalledWith('conan.lock is unchanged');
  });

  it('returns updated conan.lock for conanfile.txt', async () => {
    const updatedDeps = [
      {
        depName: 'dep',
      },
    ];
    const expectedInSnapshot = [
      {
        cmd: 'conan lock create conanfile.txt',
      },
    ];

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('conan.lock');
    fs.readLocalFile.mockResolvedValueOnce('Original conan.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Updated conan.lock');

    expect(
      await conan.updateArtifacts({
        packageFileName: 'conanfile.txt',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toEqual([
      {
        file: {
          contents: 'Updated conan.lock',
          path: 'conan.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject(expectedInSnapshot);
  });

  it('returns updated conan.lock when updateType are not empty', async () => {
    const updatedDeps = [
      {
        depName: 'dep',
      },
    ];
    const expectedInSnapshot = [
      {
        cmd: 'conan lock create conanfile.py',
      },
    ];

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('conan.lock');
    fs.readLocalFile.mockResolvedValueOnce('Original conan.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Updated conan.lock');

    expect(
      await conan.updateArtifacts({
        packageFileName: 'conanfile.py',
        updatedDeps,
        newPackageFileContent: '',
        config,
      }),
    ).toEqual([
      {
        file: {
          contents: 'Updated conan.lock',
          path: 'conan.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject(expectedInSnapshot);
  });

  it('returns updated conan.lock when updateType are empty, but isLockFileMaintenance is true', async () => {
    const expectedInSnapshot = [
      {
        cmd: 'conan lock create conanfile.py --lockfile=""',
      },
    ];

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('conan.lock');
    fs.readLocalFile.mockResolvedValueOnce('Original conan.lock');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Updated conan.lock');

    expect(
      await conan.updateArtifacts({
        packageFileName: 'conanfile.py',
        updatedDeps: [],
        newPackageFileContent: '',
        config: { ...config, isLockFileMaintenance: true },
      }),
    ).toEqual([
      {
        file: {
          contents: 'Updated conan.lock',
          path: 'conan.lock',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject(expectedInSnapshot);
  });

  it('rethrows temporary error', async () => {
    const updatedDeps = [
      {
        depName: 'dep',
      },
    ];

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('conan.lock');
    fs.readLocalFile.mockResolvedValueOnce('Original conan.lock');
    mockExecAll(new Error(TEMPORARY_ERROR));

    await expect(
      conan.updateArtifacts({
        packageFileName: 'conanfile.py',
        updatedDeps,
        newPackageFileContent: '',
        config: { ...config, updateType: 'lockFileMaintenance' },
      }),
    ).rejects.toThrow(TEMPORARY_ERROR);
  });

  it('returns an artifact error when conan.lock update fails', async () => {
    const updatedDeps = [
      {
        depName: 'dep',
      },
    ];
    const errorMessage = 'conan.lock update execution failure message';

    fs.findLocalSiblingOrParent.mockResolvedValueOnce('conan.lock');
    fs.readLocalFile.mockResolvedValueOnce('Original conan.lock');
    mockExecAll(new Error(errorMessage));

    expect(
      await conan.updateArtifacts({
        packageFileName: 'conanfile.py',
        updatedDeps,
        newPackageFileContent: '',
        config: { ...config, updateType: 'lockFileMaintenance' },
      }),
    ).toEqual([
      { artifactError: { lockFile: 'conan.lock', stderr: errorMessage } },
    ]);
  });
});
