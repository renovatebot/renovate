import { quote } from 'shlex';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { ExecError } from '../../../util/exec/exec-error.ts';
import { getPkgReleases as _getPkgReleases } from '../../datasource/index.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../../datasource/index.ts', () => mockDeep());

const getPkgReleases = vi.mocked(_getPkgReleases);

const repoDir = '/tmp/github/some/repo';

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: repoDir,
  binarySource: 'global',
};

function lockCwd(packageFileName: string): string {
  return upath.join(repoDir, upath.dirname(packageFileName));
}

function artifact(overrides: Partial<UpdateArtifact> = {}): UpdateArtifact {
  return {
    packageFileName: 'apko.yaml',
    updatedDeps: [],
    newPackageFileContent: 'contents: {}\n',
    config: {},
    ...overrides,
  };
}

describe('modules/manager/apko/artifacts', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
    fs.getSiblingFileName.mockImplementation(
      (fileName: string, siblingName: string) =>
        upath.join(upath.dirname(fileName), siblingName),
    );
    fs.readLocalFile.mockResolvedValue(null);
  });

  it('does not create a lock file when an update has no lock', async () => {
    const execSnapshots = mockExecAll();

    await expect(
      updateArtifacts(
        artifact({
          updatedDeps: [{ depName: 'bash', newValue: '5.2.38-r0' }],
        }),
      ),
    ).resolves.toBeNull();
    expect(execSnapshots).toEqual([]);
    expect(fs.writeLocalFile).not.toHaveBeenCalled();
  });

  it('does not create a lock file during maintenance when none exists', async () => {
    const execSnapshots = mockExecAll();

    await expect(
      updateArtifacts(
        artifact({
          config: { isLockFileMaintenance: true },
        }),
      ),
    ).resolves.toBeNull();
    expect(execSnapshots).toEqual([]);
    expect(fs.writeLocalFile).not.toHaveBeenCalled();
  });

  it('does not run apko when nothing changed and maintenance is off', async () => {
    fs.readLocalFile.mockResolvedValue('old\n');
    const execSnapshots = mockExecAll();

    await expect(updateArtifacts(artifact())).resolves.toBeNull();
    expect(execSnapshots).toEqual([]);
    expect(fs.writeLocalFile).not.toHaveBeenCalled();
  });

  it('regenerates the lock file when a dependency changes', async () => {
    vi.stubEnv('CONTAINERBASE', 'true');
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '0.30.0' }, { version: '0.31.0' }],
    });
    fs.readLocalFile.mockResolvedValueOnce('old\n');
    fs.readLocalFile.mockResolvedValueOnce('new\n');
    const execSnapshots = mockExecAll();
    const newPackageFileContent =
      'contents:\n  packages:\n    - bash=5.2.38-r0\n';

    await expect(
      updateArtifacts(
        artifact({
          updatedDeps: [{ depName: 'bash', newValue: '5.2.38-r0' }],
          newPackageFileContent,
        }),
      ),
    ).resolves.toEqual([
      {
        file: {
          type: 'addition',
          path: 'apko.lock.json',
          contents: 'new\n',
        },
      },
    ]);
    expect(fs.writeLocalFile).toHaveBeenCalledWith(
      'apko.yaml',
      newPackageFileContent,
    );
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool apko 0.31.0', options: { cwd: repoDir } },
      { cmd: 'apko lock apko.yaml', options: { cwd: repoDir } },
    ]);
  });

  it('passes constraints.apko to the apko install', async () => {
    vi.stubEnv('CONTAINERBASE', 'true');
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    fs.readLocalFile.mockResolvedValueOnce('old\n');
    fs.readLocalFile.mockResolvedValueOnce('new\n');
    const execSnapshots = mockExecAll();

    await expect(
      updateArtifacts(
        artifact({
          updatedDeps: [{ depName: 'bash', newValue: '5.2.38-r0' }],
          config: { constraints: { apko: '0.30.11' } },
        }),
      ),
    ).resolves.toEqual([
      {
        file: {
          type: 'addition',
          path: 'apko.lock.json',
          contents: 'new\n',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool apko 0.30.11' },
      { cmd: 'apko lock apko.yaml' },
    ]);
  });

  it('quotes a package file path that contains a space', async () => {
    const packageFileName = 'dir/my file.yaml';
    fs.readLocalFile.mockResolvedValueOnce('old\n');
    fs.readLocalFile.mockResolvedValueOnce('new\n');
    const execSnapshots = mockExecAll();

    await expect(
      updateArtifacts(
        artifact({
          packageFileName,
          updatedDeps: [{ depName: 'bash', newValue: '5.2.38-r0' }],
        }),
      ),
    ).resolves.toEqual([
      {
        file: {
          type: 'addition',
          path: 'dir/my file.lock.json',
          contents: 'new\n',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: `apko lock ${quote('my file.yaml')}`,
        options: { cwd: lockCwd(packageFileName) },
      },
    ]);
  });

  it('regenerates the lock file during maintenance with no dependency updates', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old\n');
    fs.readLocalFile.mockResolvedValueOnce('new\n');
    const execSnapshots = mockExecAll();

    await expect(
      updateArtifacts(
        artifact({
          config: { isLockFileMaintenance: true },
        }),
      ),
    ).resolves.toEqual([
      {
        file: {
          type: 'addition',
          path: 'apko.lock.json',
          contents: 'new\n',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([{ cmd: 'apko lock apko.yaml' }]);
  });

  it('returns null when the lock file content does not change', async () => {
    fs.readLocalFile.mockResolvedValueOnce('same\n');
    fs.readLocalFile.mockResolvedValueOnce('same\n');
    const execSnapshots = mockExecAll();

    await expect(
      updateArtifacts(
        artifact({
          updatedDeps: [{ depName: 'bash', newValue: '5.2.38-r0' }],
        }),
      ),
    ).resolves.toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: 'apko lock apko.yaml' }]);
  });

  it('returns null when the new lock file cannot be read', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old\n');
    fs.readLocalFile.mockResolvedValueOnce(null);
    const execSnapshots = mockExecAll();

    await expect(
      updateArtifacts(
        artifact({
          updatedDeps: [{ depName: 'bash', newValue: '5.2.38-r0' }],
        }),
      ),
    ).resolves.toBeNull();
    expect(execSnapshots).toMatchObject([{ cmd: 'apko lock apko.yaml' }]);
  });

  it('returns an artifact error with the lock file name', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old\n');
    mockExecAll(
      new ExecError('apko failed', {
        cmd: 'apko lock apko.yaml',
        stdout: '',
        stderr: 'boom',
        options: {},
      }),
    );

    await expect(
      updateArtifacts(
        artifact({
          updatedDeps: [{ depName: 'bash', newValue: '5.2.38-r0' }],
        }),
      ),
    ).resolves.toEqual([
      {
        artifactError: {
          fileName: 'apko.lock.json',
          stderr: 'boom',
        },
      },
    ]);
  });

  it('rethrows TEMPORARY_ERROR', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old\n');
    mockExecAll(new Error(TEMPORARY_ERROR));

    await expect(
      updateArtifacts(
        artifact({
          updatedDeps: [{ depName: 'bash', newValue: '5.2.38-r0' }],
        }),
      ),
    ).rejects.toThrow(TEMPORARY_ERROR);
  });

  it('locks image.lock.json next to image.yaml', async () => {
    fs.readLocalFile.mockResolvedValueOnce('old\n');
    fs.readLocalFile.mockResolvedValueOnce('new\n');
    const execSnapshots = mockExecAll();

    await expect(
      updateArtifacts(
        artifact({
          packageFileName: 'dir/image.yaml',
          updatedDeps: [{ depName: 'bash', newValue: '5.2.38-r0' }],
        }),
      ),
    ).resolves.toEqual([
      {
        file: {
          type: 'addition',
          path: 'dir/image.lock.json',
          contents: 'new\n',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'apko lock image.yaml',
        options: { cwd: lockCwd('dir/image.yaml') },
      },
    ]);
  });

  it('locks images/apko.lock.json from images/apko.yaml', async () => {
    const packageFileName = 'images/apko.yaml';
    fs.readLocalFile.mockResolvedValueOnce('old\n');
    fs.readLocalFile.mockResolvedValueOnce('new\n');
    const execSnapshots = mockExecAll();

    await expect(
      updateArtifacts(
        artifact({
          packageFileName,
          updatedDeps: [{ depName: 'bash', newValue: '5.2.38-r0' }],
        }),
      ),
    ).resolves.toEqual([
      {
        file: {
          type: 'addition',
          path: 'images/apko.lock.json',
          contents: 'new\n',
        },
      },
    ]);
    expect(fs.readLocalFile).toHaveBeenCalledWith(
      'images/apko.lock.json',
      'utf8',
    );
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'apko lock apko.yaml',
        options: { cwd: lockCwd(packageFileName) },
      },
    ]);
  });
});
