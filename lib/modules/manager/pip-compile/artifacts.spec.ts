import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { Fixtures } from '../../../../test/fixtures';
import {
  env,
  fs,
  git,
  hostRules,
  mocked,
  partial,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { logger } from '../../../logger';
import * as docker from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import {
  constructPipCompileCmd,
  extractResolver,
  getRegistryUrlVarsFromPackageFile,
} from './artifacts';
import { updateArtifacts } from '.';

const datasource = mocked(_datasource);

jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/host-rules', () => mockDeep());
jest.mock('../../../util/http');
jest.mock('../../datasource', () => mockDeep());

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
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if unchanged', async () => {
    fs.readLocalFile.mockResolvedValueOnce('content');
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('content');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config,
      }),
    ).toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'pip-compile requirements.in' },
    ]);
  });

  it('returns updated requirements.txt', async () => {
    fs.readLocalFile.mockResolvedValueOnce('current requirements.txt');
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
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '3.7' } },
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
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    fs.ensureCacheDir.mockResolvedValueOnce('/tmp/renovate/cache/others/pip');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '3.10.2' } },
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
    fs.readLocalFile.mockResolvedValueOnce('new lock');
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: 'some new content',
        config: { ...config, constraints: { python: '3.10.2' } },
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

  it('catches errors', async () => {
    const execSnapshots = mockExecAll();
    fs.readLocalFile.mockResolvedValueOnce('Current requirements.txt');
    fs.writeLocalFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'requirements.in',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      }),
    ).toEqual([
      {
        artifactError: { lockFile: 'requirements.txt', stderr: 'not found' },
      },
    ]);
    expect(execSnapshots).toEqual([]);
  });

  it('returns updated requirements.txt when doing lockfile maintenance', async () => {
    fs.readLocalFile.mockResolvedValueOnce('Current requirements.txt');
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
        config: lockMaintenanceConfig,
      }),
    ).not.toBeNull();
    expect(execSnapshots).toMatchObject([
      { cmd: 'pip-compile requirements.in' },
    ]);
  });

  it('uses pip-compile version from config', async () => {
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
    it('returns default cmd for garbage', () => {
      expect(
        constructPipCompileCmd(
          Fixtures.get('requirementsNoHeaders.txt'),
          'subdir/requirements.in',
          'subdir/requirements.txt',
          false,
        ),
      ).toBe('pip-compile requirements.in');
    });

    it('returns --no-emit-index-url when credentials are present in URLs', () => {
      expect(
        constructPipCompileCmd(
          Fixtures.get('requirementsNoHeaders.txt'),
          'subdir/requirements.in',
          'subdir/requirements.txt',
          true,
        ),
      ).toBe('pip-compile --no-emit-index-url requirements.in');
    });

    it('returns extracted common arguments (like those featured in the README)', () => {
      expect(
        constructPipCompileCmd(
          Fixtures.get('requirementsWithHashes.txt'),
          'subdir/requirements.in',
          'subdir/requirements.txt',
          false,
        ),
      ).toBe(
        'pip-compile --allow-unsafe --generate-hashes --no-emit-index-url --strip-extras --resolver=backtracking --output-file=requirements.txt requirements.in',
      );
    });

    it('returns --no-emit-index-url only once when its in the header and credentials are present in URLs', () => {
      expect(
        constructPipCompileCmd(
          Fixtures.get('requirementsWithHashes.txt'),
          'subdir/requirements.in',
          'subdir/requirements.txt',
          true,
        ),
      ).toBe(
        'pip-compile --allow-unsafe --generate-hashes --no-emit-index-url --strip-extras --resolver=backtracking --output-file=requirements.txt requirements.in',
      );
    });

    it('skips unknown arguments', () => {
      expect(
        constructPipCompileCmd(
          Fixtures.get('requirementsWithUnknownArguments.txt'),
          'subdir/requirements.in',
          'subdir/requirements.txt',
          false,
        ),
      ).toBe('pip-compile --generate-hashes requirements.in');
      expect(logger.trace).toHaveBeenCalledWith(
        { argument: '--version' },
        'pip-compile argument is not (yet) supported',
      );
      expect(logger.warn).toHaveBeenCalledWith(
        { argument: '--resolver=foobar' },
        'pip-compile was previously executed with an unexpected `--resolver` value',
      );
    });

    it('skips exploitable subcommands and files', () => {
      expect(
        constructPipCompileCmd(
          Fixtures.get('requirementsWithExploitingArguments.txt'),
          'subdir/requirements.in',
          'subdir/requirements.txt',
          false,
        ),
      ).toBe(
        'pip-compile --generate-hashes --output-file=requirements.txt requirements.in',
      );
      expect(logger.warn).toHaveBeenCalledWith(
        { argument: '--output-file=/etc/shadow' },
        'pip-compile was previously executed with an unexpected `--output-file` filename',
      );
    });
  });

  describe('getRegistryUrlFlagsFromPackageFile()', () => {
    it('handles both registryUrls and additionalRegistryUrls', () => {
      hostRules.find.mockReturnValue({});
      expect(
        getRegistryUrlVarsFromPackageFile({
          deps: [],
          registryUrls: ['https://example.com/pypi/simple'],
          additionalRegistryUrls: ['https://example2.com/pypi/simple'],
        }),
      ).toEqual({
        haveCredentials: false,
        environmentVars: {
          PIP_INDEX_URL: 'https://example.com/pypi/simple',
          PIP_EXTRA_INDEX_URL: 'https://example2.com/pypi/simple',
        },
      });
    });

    it('handles multiple additionalRegistryUrls', () => {
      hostRules.find.mockReturnValue({});
      expect(
        getRegistryUrlVarsFromPackageFile({
          deps: [],
          additionalRegistryUrls: [
            'https://example.com/pypi/simple',
            'https://example2.com/pypi/simple',
          ],
        }),
      ).toEqual({
        haveCredentials: false,
        environmentVars: {
          PIP_EXTRA_INDEX_URL:
            'https://example.com/pypi/simple https://example2.com/pypi/simple',
        },
      });
    });

    it('uses extra index URLs with no auth', () => {
      hostRules.find.mockReturnValue({});
      expect(
        getRegistryUrlVarsFromPackageFile({
          deps: [],
          registryUrls: ['https://example.com/pypi/simple'],
        }),
      ).toEqual({
        haveCredentials: false,
        environmentVars: {
          PIP_INDEX_URL: 'https://example.com/pypi/simple',
        },
      });
    });

    it('uses auth from extra index URLs matching host rules', () => {
      hostRules.find.mockReturnValue({
        username: 'user',
        password: 'password',
      });
      expect(
        getRegistryUrlVarsFromPackageFile({
          deps: [],
          registryUrls: ['https://example.com/pypi/simple'],
        }),
      ).toEqual({
        haveCredentials: true,
        environmentVars: {
          PIP_INDEX_URL: 'https://user:password@example.com/pypi/simple',
        },
      });
    });
  });

  describe('extractResolver()', () => {
    it.each([
      ['--resolver=backtracking', 'backtracking'],
      ['--resolver=legacy', 'legacy'],
    ])(
      'returns expected value for supported %s resolver',
      (argument: string, expected: string) => {
        expect(extractResolver(argument)).toBe(expected);
      },
    );

    it.each(['--resolver=foo', '--resolver='])(
      'returns null for unsupported %s resolver',
      (argument: string) => {
        expect(extractResolver(argument)).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          { argument },
          'pip-compile was previously executed with an unexpected `--resolver` value',
        );
      },
    );
  });
});
