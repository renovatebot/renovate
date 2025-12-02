import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import {
  BUNDLER_INVALID_CREDENTIALS,
  TEMPORARY_ERROR,
} from '../../../constants/error-messages';
import * as docker from '../../../util/exec/docker';
import { ExecError } from '../../../util/exec/exec-error';
import type { StatusResult } from '../../../util/git/types';
import * as _datasource from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import * as _bundlerHostRules from './host-rules';
import { updateArtifacts } from '.';
import { envMock, mockExecAll, mockExecSequence } from '~test/exec-util';
import { env, fs, git, partial } from '~test/util';

const datasource = vi.mocked(_datasource);
const bundlerHostRules = vi.mocked(_bundlerHostRules);

vi.mock('../../../util/exec/env');
vi.mock('../../datasource', () => mockDeep());
vi.mock('../../../util/fs');
vi.mock('../../../util/host-rules', () => mockDeep());
vi.mock('./host-rules');

process.env.CONTAINERBASE = 'true';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

const config: UpdateArtifactsConfig = {};

const updatedGemfileLock = {
  file: {
    type: 'addition',
    path: 'Gemfile.lock',
    contents: 'Updated Gemfile.lock',
  },
};

describe('modules/manager/bundler/artifacts', () => {
  describe('updateArtifacts', () => {
    beforeEach(() => {
      delete process.env.GEM_HOME;

      env.getChildProcessEnv.mockReturnValue(envMock.basic);
      bundlerHostRules.findAllAuthenticatable.mockReturnValue([]);
      docker.resetPrefetchedImages();

      GlobalConfig.set(adminConfig);
      fs.ensureCacheDir.mockResolvedValue('/tmp/cache/others/gem');
    });

    afterEach(() => {
      GlobalConfig.reset();
    });

    it('returns null by default', async () => {
      expect(
        await updateArtifacts({
          packageFileName: '',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: '',
          config,
        }),
      ).toBeNull();
    });

    it('returns null if Gemfile.lock was not changed', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce();
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
        }),
      );
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        }),
      ).toBeNull();
      expect(execSnapshots).toMatchObject([
        { cmd: 'bundler lock --update foo bar' },
      ]);
    });

    it('executes commands from lockFile path', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce();
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
        }),
      );
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'teamA/Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        }),
      ).toBeNull();
      expect(execSnapshots).toMatchObject([
        { options: { cwd: '/tmp/github/some/repo' } },
      ]);
    });

    it('works for default binarySource', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.readLocalFile.mockResolvedValueOnce(null); // .ruby-version
      fs.readLocalFile.mockResolvedValueOnce(null); // .tool-versions
      fs.localPathExists.mockResolvedValueOnce(true); // Gemfile.lock
      fs.readLocalFile.mockResolvedValueOnce(null); // Gemfile.lock
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['Gemfile.lock'],
        }),
      );
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        }),
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'bundler lock --update foo bar' },
      ]);
    });

    it('works explicit global binarySource', async () => {
      GlobalConfig.set({ ...adminConfig, binarySource: 'global' });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.readLocalFile.mockResolvedValueOnce(null); // .ruby-version
      fs.readLocalFile.mockResolvedValueOnce(null); // .tool-versions
      fs.localPathExists.mockResolvedValueOnce(true); // Gemfile.lock
      fs.readLocalFile.mockResolvedValueOnce(null); // Gemfile.lock
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['Gemfile.lock'],
        }),
      );
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        }),
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'bundler lock --update foo bar' },
      ]);
    });

    it('supports conservative mode and updateType option', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.readLocalFile.mockResolvedValueOnce(null); // .ruby-version
      fs.readLocalFile.mockResolvedValueOnce(null); // .tool-versions
      fs.localPathExists.mockResolvedValueOnce(true); // Gemfile.lock
      fs.readLocalFile.mockResolvedValueOnce(null); // Gemfile.lock
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['Gemfile.lock'],
        }),
      );
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [
            { depName: 'foo', updateType: 'minor' },
            { depName: 'bar', updateType: 'patch' },
          ],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            updateType: 'patch',
            postUpdateOptions: [
              ...(config.postUpdateOptions ?? []),
              'bundlerConservative',
            ],
          },
        }),
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        expect.objectContaining({
          cmd: 'bundler lock --patch --conservative --update bar',
        }),
        expect.objectContaining({
          cmd: 'bundler lock --minor --conservative --update foo',
        }),
      ]);
    });

    it('supports install mode', async () => {
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'install',
      });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.readLocalFile.mockResolvedValueOnce('1.2.0');
      // bundler
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [{ version: '1.17.2' }, { version: '2.3.5' }],
      });
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['Gemfile.lock'],
        }),
      );
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
          newPackageFileContent: 'Updated Gemfile content',
          config,
        }),
      ).toEqual([updatedGemfileLock]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool ruby 1.2.0' },
        { cmd: 'install-tool bundler 2.3.5' },
        { cmd: 'ruby --version' },
        { cmd: 'bundler lock --update foo bar' },
      ]);
    });

    describe('Docker', () => {
      beforeEach(() => {
        GlobalConfig.set({
          ...adminConfig,
          binarySource: 'docker',
        });
      });

      it('.ruby-version', async () => {
        fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
        fs.readLocalFile.mockResolvedValueOnce('1.2.0');
        // bundler
        datasource.getPkgReleases.mockResolvedValueOnce({
          releases: [{ version: '1.17.2' }, { version: '2.3.5' }],
        });
        const execSnapshots = mockExecAll();
        git.getRepoStatus.mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['Gemfile.lock'],
          }),
        );
        fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
        expect(
          await updateArtifacts({
            packageFileName: 'Gemfile',
            updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
            newPackageFileContent: 'Updated Gemfile content',
            config,
          }),
        ).toEqual([updatedGemfileLock]);
        expect(execSnapshots).toMatchObject([
          { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
          { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
          {
            cmd:
              'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
              '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
              '-v "/tmp/cache":"/tmp/cache" ' +
              '-e GEM_HOME ' +
              '-e CONTAINERBASE_CACHE_DIR ' +
              '-w "/tmp/github/some/repo" ' +
              'ghcr.io/containerbase/sidecar' +
              ' bash -l -c "' +
              'install-tool ruby 1.2.0' +
              ' && ' +
              'install-tool bundler 2.3.5' +
              ' && ' +
              'ruby --version' +
              ' && ' +
              'bundler lock --update foo bar' +
              '"',
          },
        ]);
      });

      it('constraints options', async () => {
        GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
        fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
        datasource.getPkgReleases.mockResolvedValueOnce({
          releases: [{ version: '1.17.2' }, { version: '2.3.5' }],
        });
        datasource.getPkgReleases.mockResolvedValueOnce({
          releases: [
            { version: '1.0.0' },
            { version: '1.2.0' },
            { version: '1.3.0' },
          ],
        });
        const execSnapshots = mockExecAll();
        git.getRepoStatus.mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['Gemfile.lock'],
          }),
        );
        fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
        expect(
          await updateArtifacts({
            packageFileName: 'Gemfile',
            updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
            newPackageFileContent: 'Updated Gemfile content',
            config: {
              ...config,
              constraints: {
                ruby: '1.2.5',
                bundler: '3.2.1',
              },
            },
          }),
        ).toEqual([updatedGemfileLock]);
        expect(execSnapshots).toMatchObject([
          { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
          { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
          {
            cmd:
              'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
              '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
              '-v "/tmp/cache":"/tmp/cache" ' +
              '-e GEM_HOME ' +
              '-e CONTAINERBASE_CACHE_DIR ' +
              '-w "/tmp/github/some/repo" ' +
              'ghcr.io/containerbase/sidecar' +
              ' bash -l -c "' +
              'install-tool ruby 1.2.5' +
              ' && ' +
              'install-tool bundler 3.2.1' +
              ' && ' +
              'ruby --version' +
              ' && ' +
              'bundler lock --update foo bar' +
              '"',
          },
        ]);
      });

      it('invalid constraints options', async () => {
        GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
        fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
        // ruby
        datasource.getPkgReleases.mockResolvedValueOnce({
          releases: [
            { version: '1.0.0' },
            { version: '1.2.0' },
            { version: '1.3.0' },
          ],
        });
        // bundler
        datasource.getPkgReleases.mockResolvedValueOnce({
          releases: [{ version: '1.17.2' }, { version: '2.3.5' }],
        });
        const execSnapshots = mockExecAll();
        git.getRepoStatus.mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['Gemfile.lock'],
          }),
        );
        fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
        expect(
          await updateArtifacts({
            packageFileName: 'Gemfile',
            updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
            newPackageFileContent: 'Updated Gemfile content',
            config: {
              ...config,
              constraints: {
                ruby: 'foo',
                bundler: 'bar',
              },
            },
          }),
        ).toEqual([updatedGemfileLock]);
        expect(execSnapshots).toMatchObject([
          { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
          { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
          {
            cmd:
              'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
              '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
              '-v "/tmp/cache":"/tmp/cache" ' +
              '-e GEM_HOME ' +
              '-e CONTAINERBASE_CACHE_DIR ' +
              '-w "/tmp/github/some/repo" ' +
              'ghcr.io/containerbase/sidecar' +
              ' bash -l -c "' +
              'install-tool ruby 1.3.0' +
              ' && ' +
              'install-tool bundler 2.3.5' +
              ' && ' +
              'ruby --version' +
              ' && ' +
              'bundler lock --update foo bar' +
              '"',
          },
        ]);
      });

      it('injects bundler host configuration environment variables', async () => {
        GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
        fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
        fs.readLocalFile.mockResolvedValueOnce('1.2.0');
        // bundler
        datasource.getPkgReleases.mockResolvedValueOnce({
          releases: [{ version: '1.17.2' }, { version: '2.3.5' }],
        });
        bundlerHostRules.findAllAuthenticatable.mockReturnValue([
          {
            hostType: 'bundler',
            matchHost: 'gems-private.com',
            resolvedHost: 'gems-private.com',
            username: 'some-user',
            password: 'some-password',
          },
        ]);
        bundlerHostRules.getAuthenticationHeaderValue.mockReturnValue(
          'some-user:some-password',
        );
        const execSnapshots = mockExecAll();
        git.getRepoStatus.mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['Gemfile.lock'],
          }),
        );
        fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
        expect(
          await updateArtifacts({
            packageFileName: 'Gemfile',
            updatedDeps: [{ depName: 'foo' }, { depName: 'bar' }],
            newPackageFileContent: 'Updated Gemfile content',
            config,
          }),
        ).toEqual([updatedGemfileLock]);
        expect(execSnapshots).toMatchObject([
          { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
          { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
          {
            cmd:
              'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
              '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
              '-v "/tmp/cache":"/tmp/cache" ' +
              '-e BUNDLE_GEMS___PRIVATE__COM ' +
              '-e GEM_HOME ' +
              '-e CONTAINERBASE_CACHE_DIR ' +
              '-w "/tmp/github/some/repo" ' +
              'ghcr.io/containerbase/sidecar' +
              ' bash -l -c "' +
              'install-tool ruby 1.2.0' +
              ' && ' +
              'install-tool bundler 2.3.5' +
              ' && ' +
              'ruby --version' +
              ' && ' +
              'bundler lock --update foo bar' +
              '"',
          },
        ]);
      });
    });

    it('returns error when failing in lockFileMaintenance true', async () => {
      const execError = new ExecError('Exec error', {
        cmd: '',
        stdout: ' foo was resolved to',
        stderr: '',
        options: { encoding: 'utf8' },
      });
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce(null as never);
      const execSnapshots = mockExecAll(execError);
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['Gemfile.lock'],
        }),
      );
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {
            ...config,
            isLockFileMaintenance: true,
          },
        }),
      ).toMatchObject([{ artifactError: { lockFile: 'Gemfile.lock' } }]);
      expect(execSnapshots).toMatchObject([{ cmd: 'bundler lock --update' }]);
    });

    it('performs lockFileMaintenance', async () => {
      fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.writeLocalFile.mockResolvedValueOnce();
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['Gemfile.lock'],
        }),
      );
      fs.readLocalFile.mockResolvedValueOnce('Updated Gemfile.lock');
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {
            ...config,
            isLockFileMaintenance: true,
            updateType: 'patch', // This will have no effect together with isLockFileMaintenance
          },
        }),
      ).not.toBeNull();
      expect(execSnapshots).toMatchObject([{ cmd: 'bundler lock --update' }]);
    });

    describe('Error handling', () => {
      it('returns error when failing in lockFileMaintenance true', async () => {
        const execError = new ExecError('Exec error', {
          cmd: '',
          stdout: ' foo was resolved to',
          stderr: '',
          options: { encoding: 'utf8' },
        });
        fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
        const execSnapshots = mockExecAll(execError);
        git.getRepoStatus.mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['Gemfile.lock'],
          }),
        );
        expect(
          await updateArtifacts({
            packageFileName: 'Gemfile',
            updatedDeps: [],
            newPackageFileContent: '{}',
            config: {
              ...config,
              isLockFileMaintenance: true,
            },
          }),
        ).toMatchObject([
          {
            artifactError: {
              lockFile: 'Gemfile.lock',
            },
          },
        ]);
        expect(execSnapshots).toMatchObject([{ cmd: 'bundler lock --update' }]);
      });

      it('rethrows for temporary error', async () => {
        const execError = new ExecError(TEMPORARY_ERROR, {
          cmd: '',
          stdout: '',
          stderr: '',
          options: { encoding: 'utf8' },
        });
        fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
        mockExecAll(execError);
        await expect(
          updateArtifacts({
            packageFileName: 'Gemfile',
            updatedDeps: [],
            newPackageFileContent: '{}',
            config: {
              ...config,
              isLockFileMaintenance: true,
            },
          }),
        ).rejects.toThrow(TEMPORARY_ERROR);
      });

      it('handles "Could not parse object" error', async () => {
        const execError = new ExecError('fatal: Could not parse object', {
          cmd: '',
          stdout: 'but that version could not be found',
          stderr: '',
          options: { encoding: 'utf8' },
        });
        fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
        mockExecAll(execError);
        expect(
          await updateArtifacts({
            packageFileName: 'Gemfile',
            updatedDeps: [],
            newPackageFileContent: '{}',
            config: {
              ...config,
              isLockFileMaintenance: true,
            },
          }),
        ).toMatchObject([{ artifactError: { lockFile: 'Gemfile.lock' } }]);
      });

      it('throws on authentication errors', async () => {
        const execError = new ExecError('Exec error', {
          cmd: '',
          stdout: 'Please supply credentials for this source',
          stderr: 'Please make sure you have the correct access rights',
          options: { encoding: 'utf8' },
        });
        fs.readLocalFile.mockResolvedValueOnce('Current Gemfile.lock');
        mockExecAll(execError);
        await expect(
          updateArtifacts({
            packageFileName: 'Gemfile',
            updatedDeps: [],
            newPackageFileContent: '{}',
            config: {
              ...config,
              isLockFileMaintenance: true,
            },
          }),
        ).rejects.toThrow(BUNDLER_INVALID_CREDENTIALS);
      });

      it('handles recursive resolved dependencies', async () => {
        const execError = new ExecError('Exec error', {
          cmd: '',
          stdout: 'foo was resolved to foo',
          stderr: 'bar was resolved to bar',
          options: { encoding: 'utf8' },
        });
        fs.readLocalFile.mockResolvedValue('Current Gemfile.lock');
        const execSnapshots = mockExecSequence([
          execError,
          { stdout: '', stderr: '' },
        ]);
        git.getRepoStatus.mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['Gemfile.lock'],
          }),
        );

        const res = await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'foo' }],
          newPackageFileContent: '{}',
          config: {
            ...config,
            isLockFileMaintenance: false,
          },
        });

        expect(res).toMatchObject([{ file: { path: 'Gemfile.lock' } }]);
        expect(execSnapshots).toMatchObject([
          { cmd: 'bundler lock --update foo' },
          { cmd: 'bundler lock --update foo bar' },
        ]);
      });

      it('updates the Gemfile.lock when upgrading ruby', async () => {
        // See https://github.com/renovatebot/renovate/issues/15114
        fs.readLocalFile.mockResolvedValue('Current Gemfile.lock');
        const execSnapshots = mockExecSequence([{ stdout: '', stderr: '' }]);
        git.getRepoStatus.mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['Gemfile.lock'],
          }),
        );

        const res = await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'ruby', updateType: 'patch' }],
          newPackageFileContent: '{}',
          config,
        });

        expect(res).toMatchObject([{ file: { path: 'Gemfile.lock' } }]);
        expect(execSnapshots).toMatchObject([{ cmd: 'bundler lock' }]);
      });

      it('updates the Gemfile.lock when upgrading bundler', async () => {
        fs.readLocalFile.mockResolvedValue('Current Gemfile.lock');
        const execSnapshots = mockExecSequence([{ stdout: '', stderr: '' }]);
        git.getRepoStatus.mockResolvedValueOnce(
          partial<StatusResult>({
            modified: ['Gemfile.lock'],
          }),
        );

        const res = await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: [{ depName: 'bundler', updateType: 'patch' }],
          newPackageFileContent: '{}',
          config,
        });

        expect(res).toMatchObject([{ file: { path: 'Gemfile.lock' } }]);
        expect(execSnapshots).toMatchObject([
          { cmd: 'bundler lock --update --bundler' },
        ]);
      });
    });
  });
});
