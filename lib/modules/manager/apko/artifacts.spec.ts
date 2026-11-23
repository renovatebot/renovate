import { quote } from 'shlex';
import upath from 'upath';
import { mockExecAll } from '~test/exec-util.ts';
import { fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { ExecError } from '../../../util/exec/exec-error.ts';
import type { UpdateArtifact } from '../types.ts';
import { updateArtifacts } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions = {
  localDir: '/tmp/github/some/repo',
  binarySource: 'global',
};

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
      {
        cmd: 'apko lock apko.yaml',
        options: {
          toolConstraints: [{ toolName: 'apko', constraint: undefined }],
        },
      },
    ]);
  });

  it('passes constraints.apko to the apko install', async () => {
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
      {
        cmd: 'apko lock apko.yaml',
        options: {
          toolConstraints: [{ toolName: 'apko', constraint: '0.30.11' }],
        },
      },
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
      { cmd: `apko lock ${quote(packageFileName)}` },
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
    expect(execSnapshots).toMatchObject([{ cmd: 'apko lock dir/image.yaml' }]);
  });
});
