import { exec as _exec } from 'child_process';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { fs, git, mocked } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import { RepoGlobalConfig } from '../../config/types';
import * as _env from '../../util/exec/env';
import { StatusResult } from '../../util/git';
import { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../../lib/util/fs');
jest.mock('../../../lib/util/git');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
};
const config: UpdateArtifactsConfig = {};

describe('manager/jsonnet-bundler/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);

    setGlobalConfig(adminConfig);
  });

  it('returns null if jsonnetfile.lock does not exist', async () => {
    fs.readLocalFile.mockResolvedValueOnce(null);
    expect(
      await updateArtifacts({
        packageFileName: 'jsonnetfile.json',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });

  it('returns null if there are no changes', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current jsonnetfile.lock.json');
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: [],
      not_added: [],
      deleted: [],
      isClean(): boolean {
        return true;
      },
    } as StatusResult);
    expect(
      await updateArtifacts({
        packageFileName: 'jsonnetfile.json',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('updates the vendor dir when dependencies change', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current jsonnetfile.lock.json');
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      not_added: ['vendor/foo/main.jsonnet', 'vendor/bar/main.jsonnet'],
      modified: ['jsonnetfile.json', 'jsonnetfile.lock.json'],
      deleted: ['vendor/baz/deleted.jsonnet'],
      isClean(): boolean {
        return false;
      },
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated jsonnetfile.json');
    fs.readLocalFile.mockResolvedValueOnce('Updated jsonnetfile.lock.json');
    fs.readLocalFile.mockResolvedValueOnce('New foo/main.jsonnet');
    fs.readLocalFile.mockResolvedValueOnce('New bar/main.jsonnet');
    expect(
      await updateArtifacts({
        packageFileName: 'jsonnetfile.json',
        updatedDeps: [
          {
            depName: 'foo',
            lookupName: 'https://github.com/foo/foo.git',
          },
          {
            depName: 'foo',
            lookupName: 'ssh://git@github.com/foo/foo.git',
            managerData: {
              subdir: 'bar',
            },
          },
        ],
        newPackageFileContent: 'Updated jsonnetfile.json',
        config,
      })
    ).toMatchSnapshot([
      {
        file: {
          name: 'jsonnetfile.json',
          contents: 'Updated jsonnetfile.json',
        },
      },
      {
        file: {
          name: 'jsonnetfile.lock.json',
          contents: 'Updated jsonnetfile.lock.json',
        },
      },
      {
        file: {
          name: 'vendor/foo/main.jsonnet',
          contents: 'New foo/main.jsonnet',
        },
      },
      {
        file: {
          name: 'vendor/bar/main.jsonnet',
          contents: 'New bar/main.jsonnet',
        },
      },
      {
        file: {
          name: '|delete|',
          contents: 'vendor/baz/deleted.jsonnet',
        },
      },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs lock file maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current jsonnetfile.lock.json');
    const execSnapshots = mockExecAll(exec);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['jsonnetfile.lock.json'],
      isClean(): boolean {
        return false;
      },
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated jsonnetfile.lock.json');
    expect(
      await updateArtifacts({
        packageFileName: 'jsonnetfile.json',
        updatedDeps: [],
        newPackageFileContent: '',
        config: {
          ...config,
          isLockFileMaintenance: true,
        },
      })
    ).toMatchSnapshot([
      {
        file: {
          name: 'jsonnetfile.lock.json',
          contents: 'Updated jsonnetfile.lock.json',
        },
      },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns error when jb update fails', async () => {
    const execError = new Error();
    (execError as any).stderr = 'jb released the magic smoke';

    fs.readLocalFile.mockResolvedValueOnce('Current jsonnetfile.lock.json');
    const execSnapshots = mockExecAll(exec, execError);
    git.getRepoStatus.mockResolvedValueOnce({
      modified: ['jsonnetfile.lock.json'],
      isClean(): boolean {
        return false;
      },
    } as StatusResult);
    fs.readLocalFile.mockResolvedValueOnce('Updated jsonnetfile.lock.json');
    expect(
      await updateArtifacts({
        packageFileName: 'jsonnetfile.json',
        updatedDeps: [],
        newPackageFileContent: '',
        config: {
          ...config,
          isLockFileMaintenance: true,
        },
      })
    ).toMatchSnapshot([
      {
        artifactError: {
          lockFile: 'jsonnetfile.lock.json',
          stderr: 'jb released the magic smoke',
        },
      },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });
});
