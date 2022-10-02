import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { StatusResult } from '../../../util/git/types';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};
const config: UpdateArtifactsConfig = {};

describe('modules/manager/jsonnet-bundler/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue(envMock.basic);

    GlobalConfig.set(adminConfig);
  });

  it('returns null if jsonnetfile.lock does not exist', async () => {
    fs.readLocalFile.mockResolvedValueOnce('');
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
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
        not_added: [],
        deleted: [],
        isClean(): boolean {
          return true;
        },
      })
    );
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
    const execSnapshots = mockExecAll();
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
            packageName: 'https://github.com/foo/foo.git',
          },
          {
            depName: 'foo',
            packageName: 'ssh://git@github.com/foo/foo.git',
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
          type: 'addition',
          path: 'jsonnetfile.json',
          contents: 'Updated jsonnetfile.json',
        },
      },
      {
        file: {
          type: 'addition',
          path: 'jsonnetfile.lock.json',
          contents: 'Updated jsonnetfile.lock.json',
        },
      },
      {
        file: {
          type: 'addition',
          path: 'vendor/foo/main.jsonnet',
          contents: 'New foo/main.jsonnet',
        },
      },
      {
        file: {
          type: 'addition',
          path: 'vendor/bar/main.jsonnet',
          contents: 'New bar/main.jsonnet',
        },
      },
      {
        file: {
          type: 'deletion',
          path: 'vendor/baz/deleted.jsonnet',
        },
      },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('performs lock file maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current jsonnetfile.lock.json');
    const execSnapshots = mockExecAll();
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
          type: 'addition',
          path: 'jsonnetfile.lock.json',
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
    const execSnapshots = mockExecAll(execError);
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
