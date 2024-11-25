import { codeBlock } from 'common-tags';
import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import {
  envMock,
  mockExecAll,
  mockExecSequence,
} from '../../../../test/exec-util';
import { Fixtures } from '../../../../test/fixtures';
import { env, fs, git, mocked, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig, Upgrade } from '../types';
import { constructPipCompileCmd } from './artifacts';
import { extractHeaderCommand } from './common';
import { updateArtifacts } from '.';

const datasource = mocked(_datasource);

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/host-rules', () => mockDeep());
jest.mock('../../../util/http');
jest.mock('../../datasource', () => mockDeep());

function getCommandInHeader(command: string) {
  return `#
# This file is autogenerated by pip-compile with Python 3.11
# by the following command:
#
#    ${command}
#
`;
}

const simpleHeader = getCommandInHeader('pip-compile requirements.in');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  containerbaseDir: join('/tmp/renovate/cache/containerbase'),
};
const dockerAdminConfig = {
  ...adminConfig,
  binarySource: 'docker',
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

process.env.CONTAINERBASE = 'true';

const config: UpdateArtifactsConfig = {};
const lockMaintenanceConfig = { ...config, isLockFileMaintenance: true };

describe('modules/manager/pip-compile/artifacts', () => {
  beforeEach(() => {
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    GlobalConfig.set(adminConfig);
    docker.resetPrefetchedImages();
  });

  it('returns if no requirements.txt found', async () => {
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: '',
        config: {
          ...config,
          lockFiles: ['requirements.txt'],
        },
      }),
    ).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if all unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce(simpleHeader);
    fs.readLocalFile.mockResolvedValueOnce('dependency==1.2.3');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
          lockFiles: ['requirements.txt'],
        },
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'pip-compile requirements.in' },
    ]);
  });

  it('returns null if no config.lockFiles', async () => {
    fs.readLocalFile.mockResolvedValueOnce(simpleHeader);
    fs.readLocalFile.mockResolvedValueOnce('dependency==1.2.3');
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
        },
      }),
    ).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      { packageFileName: 'requirements.in' },
      'pip-compile: No lock files associated with a package file',
    );
  });

  it('returns updated requirements.txt', async () => {
    fs.readLocalFile.mockResolvedValueOnce(simpleHeader);
    fs.readLocalFile.mockResolvedValueOnce('dependency==1.2.3');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['requirements.txt'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
          constraints: { python: '3.7' },
          lockFiles: ['requirements.txt'],
        },
      }),
    ).not.toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'pip-compile requirements.in' },
    ]);
  });

  it('supports docker mode', async () => {
    GlobalConfig.set(dockerAdminConfig);
    // pip-tools
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '6.13.0' }],
    });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['requirements.txt'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce(simpleHeader);
    fs.readLocalFile.mockResolvedValueOnce('dependency==1.2.3');
    fs.ensureCacheDir.mockResolvedValueOnce('/tmp/renovate/cache/others/pip');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
          constraints: { python: '3.10.2' },
          lockFiles: ['requirements.txt'],
        },
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e PIP_CACHE_DIR ' +
          '-e PIP_NO_INPUT ' +
          '-e PIP_KEYRING_PROVIDER ' +
          '-e PYTHON_KEYRING_BACKEND ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar ' +
          'bash -l -c "' +
          'install-tool python 3.10.2 ' +
          '&& ' +
          'install-tool pip-tools 6.13.0 ' +
          '&& ' +
          'pip-compile requirements.in' +
          '"',
      },
    ]);
  });

  it('supports install mode', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    // pip-tools
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '6.13.0' }],
    });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['requirements.txt'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce(simpleHeader);
    fs.readLocalFile.mockResolvedValueOnce('dependency==1.2.3');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
          constraints: { python: '3.10.2' },
          lockFiles: ['requirements.txt'],
        },
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.10.2' },
      { cmd: 'install-tool pip-tools 6.13.0' },
      {
        cmd: 'pip-compile requirements.in',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('installs Python version according to the lock file', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '3.11.0' },
        { version: '3.11.1' },
        { version: '3.12.0' },
      ],
    });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['requirements.txt'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce(simpleHeader);
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
          constraints: { pipTools: '6.13.0' },
          lockFiles: ['requirements.txt'],
        },
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.11.1' },
      { cmd: 'install-tool pip-tools 6.13.0' },
      {
        cmd: 'pip-compile requirements.in',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('installs latest Python version if no constraints and not in header', async () => {
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [
        { version: '3.11.0' },
        { version: '3.11.1' },
        { version: '3.12.0' },
      ],
    });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['requirements.txt'],
      }),
    );
    // Before 6.2.0, pip-compile didn't include Python version in header
    const noPythonVersionHeader = codeBlock`
      #
      # This file is autogenerated by pip-compile
      # To update, run:
      #
      #    pip-compile requirements.in
      #
    `;
    fs.readLocalFile.mockResolvedValueOnce(noPythonVersionHeader);
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
          constraints: { pipTools: '6.13.0' },
          lockFiles: ['requirements.txt'],
        },
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool python 3.12.0' },
      { cmd: 'install-tool pip-tools 6.13.0' },
      {
        cmd: 'pip-compile requirements.in',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Current requirements.txt');
    fs.readLocalFile.mockResolvedValueOnce('dependency==1.2.3');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...config, lockFiles: ['requirements.txt'] },
      }),
    ).toEqual([
      {
        artifactError: { lockFile: 'requirements.txt', stderr: 'not found' },
      },
    ]);
    expect(execSnapshots).toEqual([]);
  });

  it('returns updated requirements.txt when doing lockfile maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce(simpleHeader);
    fs.readLocalFile.mockResolvedValueOnce('dependency==1.2.3');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['requirements.txt'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New requirements.txt');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: { ...lockMaintenanceConfig, lockFiles: ['requirements.txt'] },
      }),
    ).not.toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'pip-compile requirements.in' },
    ]);
  });

  it('uses --upgrade-package only for isLockfileUpdate', async () => {
    fs.readLocalFile.mockResolvedValueOnce(simpleHeader);
    fs.readLocalFile.mockResolvedValueOnce('dependency==1.2.3');
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['requirements.txt'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('New requirements.txt');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [
          { depName: 'foo', newVersion: '1.0.2', isLockfileUpdate: true },
          { depName: 'bar', newVersion: '2.0.0' },
        ] satisfies Upgrade[],
        newPackageFileContent: '{}',
        config: { ...lockMaintenanceConfig, lockFiles: ['requirements.txt'] },
      }),
    ).not.toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'pip-compile requirements.in --upgrade-package=foo==1.0.2',
      },
    ]);
  });

  it('uses pip-compile version from config', async () => {
    fs.readLocalFile.mockResolvedValueOnce(simpleHeader);
    fs.readLocalFile.mockResolvedValueOnce('dependency==1.2.3');
    GlobalConfig.set(dockerAdminConfig);
    // pip-tools
    datasource.getPkgReleases.mockResolvedValueOnce({
      releases: [{ version: '6.13.0' }],
    });
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['requirements.txt'],
      }),
    );
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    fs.ensureCacheDir.mockResolvedValueOnce('/tmp/renovate/cache/others/pip');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
          constraints: { python: '3.10.2', pipTools: '6.13.0' },
          lockFiles: ['requirements.txt'],
        },
      }),
    ).not.toBeNull();

    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/renovate/cache":"/tmp/renovate/cache" ' +
          '-e PIP_CACHE_DIR ' +
          '-e PIP_NO_INPUT ' +
          '-e PIP_KEYRING_PROVIDER ' +
          '-e PYTHON_KEYRING_BACKEND ' +
          '-e CONTAINERBASE_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'ghcr.io/containerbase/sidecar ' +
          'bash -l -c "' +
          'install-tool python 3.10.2 ' +
          '&& ' +
          'install-tool pip-tools 6.13.0 ' +
          '&& ' +
          'pip-compile requirements.in' +
          '"',
      },
    ]);
  });

  describe('constructPipCompileCmd()', () => {
    afterEach(() => {
      delete process.env.PIP_INDEX_URL;
      delete process.env.PIP_EXTRA_INDEX_URL;
    });

    it('throws for garbage', () => {
      expect(() =>
        constructPipCompileCmd(
          extractHeaderCommand(
            Fixtures.get('requirementsNoHeaders.txt'),
            'subdir/requirements.txt',
          ),
        ),
      ).toThrow(/extract/);
    });

    it('returns extracted common arguments (like those featured in the README)', () => {
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(
            Fixtures.get('requirementsWithHashes.txt'),
            'subdir/requirements.txt',
          ),
        ),
      ).toBe(
        'pip-compile --allow-unsafe --generate-hashes --no-emit-index-url --strip-extras --resolver=backtracking --output-file=requirements.txt requirements.in',
      );
    });

    it('returns --no-emit-index-url when credentials are found in PIP_INDEX_URL', () => {
      process.env.PIP_INDEX_URL = 'https://user:pass@example.com/pypi/simple';
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(simpleHeader, 'subdir/requirements.txt'),
        ),
      ).toBe('pip-compile --no-emit-index-url requirements.in');
    });

    it('returns --no-emit-index-url when credentials are found in PIP_EXTRA_INDEX_URL', () => {
      process.env.PIP_EXTRA_INDEX_URL =
        'https://user:pass@example.com/pypi/simple';
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(simpleHeader, 'subdir/requirements.txt'),
        ),
      ).toBe('pip-compile --no-emit-index-url requirements.in');
    });

    it('returns --no-emit-index-url when only a username is found in PIP_INDEX_URL', () => {
      process.env.PIP_INDEX_URL = 'https://user@example.com/pypi/simple';
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(simpleHeader, 'subdir/requirements.txt'),
        ),
      ).toBe('pip-compile --no-emit-index-url requirements.in');
    });

    it('returns --no-emit-index-url when only a username is found in PIP_EXTRA_INDEX_URL', () => {
      process.env.PIP_EXTRA_INDEX_URL = 'https://user@example.com/pypi/simple';
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(simpleHeader, 'subdir/requirements.txt'),
        ),
      ).toBe('pip-compile --no-emit-index-url requirements.in');
    });

    it('returns --no-emit-index-url when only a password is found in PIP_INDEX_URL', () => {
      process.env.PIP_INDEX_URL = 'https://:pass@example.com/pypi/simple';
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(simpleHeader, 'subdir/requirements.txt'),
        ),
      ).toBe('pip-compile --no-emit-index-url requirements.in');
    });

    it('returns --no-emit-index-url when only a password is found in PIP_EXTRA_INDEX_URL', () => {
      process.env.PIP_EXTRA_INDEX_URL = 'https://:pass@example.com/pypi/simple';
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(simpleHeader, 'subdir/requirements.txt'),
        ),
      ).toBe('pip-compile --no-emit-index-url requirements.in');
    });

    it('returns --no-emit-index-url when PIP_INDEX_URL is invalid', () => {
      process.env.PIP_INDEX_URL = 'invalid-url';
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(simpleHeader, 'subdir/requirements.txt'),
        ),
      ).toBe('pip-compile --no-emit-index-url requirements.in');
    });

    it('returns --no-emit-index-url PIP_EXTRA_INDEX_URL is invalid', () => {
      process.env.PIP_EXTRA_INDEX_URL = 'invalid-url';
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(simpleHeader, 'subdir/requirements.txt'),
        ),
      ).toBe('pip-compile --no-emit-index-url requirements.in');
    });

    it('returns --no-emit-index-url only once when its in the header and credentials are present in the environment', () => {
      process.env.PIP_EXTRA_INDEX_URL =
        'https://user:pass@example.com/pypi/simple';
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(
            Fixtures.get('requirementsWithHashes.txt'),
            'subdir/requirements.txt',
          ),
        ),
      ).toBe(
        'pip-compile --allow-unsafe --generate-hashes --no-emit-index-url --strip-extras --resolver=backtracking --output-file=requirements.txt requirements.in',
      );
    });

    it('allow explicit --emit-index-url', () => {
      process.env.PIP_INDEX_URL = 'https://user:pass@example.com/pypi/simple';
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(
            getCommandInHeader('pip-compile --emit-index-url requirements.in'),
            'subdir/requirements.txt',
          ),
        ),
      ).toBe('pip-compile --emit-index-url requirements.in');
    });

    it('throws on unknown arguments', () => {
      expect(() =>
        constructPipCompileCmd(
          extractHeaderCommand(
            Fixtures.get('requirementsWithUnknownArguments.txt'),
            'subdir/requirements.txt',
          ),
        ),
      ).toThrow(/supported/);
    });

    it('throws on custom command', () => {
      expect(() =>
        constructPipCompileCmd(
          extractHeaderCommand(
            Fixtures.get('requirementsCustomCommand.txt'),
            'subdir/requirements.txt',
          ),
        ),
      ).toThrow(/custom/);
    });

    it('add --upgrade-package to command if Upgrade[] passed', () => {
      expect(
        constructPipCompileCmd(
          extractHeaderCommand(
            getCommandInHeader(
              'pip-compile --output-file=requirements.txt requirements.in',
            ),
            'subdir/requirements.txt',
          ),
          [
            { depName: 'foo', newVersion: '1.0.2' },
            { depName: 'bar', newVersion: '2.0.0' },
          ] satisfies Upgrade[],
        ),
      ).toBe(
        'pip-compile --output-file=requirements.txt requirements.in --upgrade-package=foo==1.0.2 --upgrade-package=bar==2.0.0',
      );
    });

    it('reports errors when a lock file is unchanged', async () => {
      fs.readLocalFile.mockResolvedValue(simpleHeader);
      mockExecSequence([
        new Error('Oh noes!'),
        { stdout: 'This one worked', stderr: '' },
      ]);
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: [],
        }),
      );
      const results = await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: {
          ...config,
          lockFiles: ['requirements1.txt', 'requirements2.txt'],
        },
      });
      expect(results).toMatchObject([
        {
          artifactError: { lockFile: 'requirements1.txt', stderr: 'Oh noes!' },
        },
      ]);
    });
  });
});