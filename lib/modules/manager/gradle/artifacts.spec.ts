import os from 'node:os';
import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import {
  envMock,
  mockExecAll,
  mockExecSequence,
} from '../../../../test/exec-util';
import {
  env,
  fs,
  git,
  logger,
  mockedFunction,
  partial,
  scm,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { resetPrefetchedImages } from '../../../util/exec/docker';
import { ExecError } from '../../../util/exec/exec-error';
import type { StatusResult } from '../../../util/git/types';
import { getPkgReleases } from '../../datasource';
import { updateArtifacts } from '.';

jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/exec/env');
jest.mock('../../datasource', () => mockDeep());

process.env.CONTAINERBASE = 'true';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
  dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
};

const osPlatformSpy = jest.spyOn(os, 'platform');

describe('modules/manager/gradle/artifacts', () => {
  beforeEach(() => {
    osPlatformSpy.mockReturnValue('linux');
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });

    GlobalConfig.set(adminConfig);
    resetPrefetchedImages();

    // java
    mockedFunction(getPkgReleases).mockResolvedValue({
      releases: [
        { version: '8.0.1' },
        { version: '11.0.1' },
        { version: '16.0.1' },
        { version: '17.0.0' },
      ],
    });

    fs.findUpLocal.mockResolvedValue('gradlew');
    scm.getFileList.mockResolvedValue([
      'gradlew',
      'build.gradle',
      'gradle.lockfile',
      'gradle/wrapper/gradle-wrapper.properties',
    ]);
    git.getFiles.mockResolvedValue({
      'gradle.lockfile': 'Current gradle.lockfile',
    });
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: ['build.gradle', 'gradle.lockfile'],
      }),
    );

    // TODO: fix types, jest is using wrong overload (#22198)
    fs.readLocalFile.mockImplementation((fileName: string): Promise<any> => {
      let content = '';
      if (fileName === 'gradle.lockfile') {
        content = 'New gradle.lockfile';
      } else if (fileName === 'gradle/wrapper/gradle-wrapper.properties') {
        content =
          'distributionUrl=https\\://services.gradle.org/distributions/gradle-7.2-bin.zip';
      } else if (fileName === 'gradle/verification-metadata.xml') {
        content =
          '<verify-metadata>true</verify-metadata><sha256 value="hash" origin="test data"/>';
      }

      return Promise.resolve(content);
    });
  });

  describe('lockfile tests', () => {
    it('aborts if no lockfile is found', async () => {
      const execSnapshots = mockExecAll();
      scm.getFileList.mockResolvedValue(['build.gradle', 'settings.gradle']);

      expect(
        await updateArtifacts({
          packageFileName: 'build.gradle',
          updatedDeps: [],
          newPackageFileContent: '',
          config: {},
        }),
      ).toBeNull();

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'No Gradle dependency lockfiles or verification metadata found - skipping update',
      );
      expect(execSnapshots).toBeEmptyArray();
    });

    it('aborts if lock file exists but no gradle wrapper', async () => {
      const execSnapshots = mockExecAll();
      fs.findUpLocal.mockResolvedValue(null);

      expect(
        await updateArtifacts({
          packageFileName: 'build.gradle',
          updatedDeps: [],
          newPackageFileContent: '',
          config: {},
        }),
      ).toBeNull();

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Found Gradle dependency lockfiles but no gradlew - aborting update',
      );
      expect(execSnapshots).toBeEmptyArray();
    });

    it('updates lock file', async () => {
      const execSnapshots = mockExecAll();

      const res = await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [
          { depName: 'org.junit.jupiter:junit-jupiter-api' },
          { depName: 'org.junit.jupiter:junit-jupiter-engine' },
        ],
        newPackageFileContent: '',
        config: {},
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'gradle.lockfile',
            contents: 'New gradle.lockfile',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q properties',
          options: {
            cwd: '/tmp/github/some/repo',
          },
        },
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q :dependencies --update-locks org.junit.jupiter:junit-jupiter-api,org.junit.jupiter:junit-jupiter-engine',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('updates lock file in win32', async () => {
      osPlatformSpy.mockReturnValue('win32');

      const execSnapshots = mockExecAll();

      const res = await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [
          { depName: 'org.junit.jupiter:junit-jupiter-api' },
          { depName: 'org.junit.jupiter:junit-jupiter-engine' },
        ],
        newPackageFileContent: '',
        config: {},
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'gradle.lockfile',
            contents: 'New gradle.lockfile',
          },
        },
      ]);

      // In win32, gradle.bat will be used and /dev/null redirection isn't used yet
      expect(execSnapshots).toMatchObject([
        {
          cmd: 'gradlew.bat --console=plain --dependency-verification lenient -q properties',
          options: {
            cwd: '/tmp/github/some/repo',
          },
        },
        {
          cmd: 'gradlew.bat --console=plain --dependency-verification lenient -q :dependencies --update-locks org.junit.jupiter:junit-jupiter-api,org.junit.jupiter:junit-jupiter-engine',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('prefers packageName over depName if provided', async () => {
      const execSnapshots = mockExecAll();

      const res = await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [
          {
            depType: 'plugin',
            depName: 'org.springframework.boot',
            packageName:
              'org.springframework.boot:org.springframework.boot.gradle.plugin',
          },
        ],
        newPackageFileContent: '',
        config: {},
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'gradle.lockfile',
            contents: 'New gradle.lockfile',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q properties',
          options: {
            cwd: '/tmp/github/some/repo',
          },
        },
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q :dependencies --update-locks org.springframework.boot:org.springframework.boot.gradle.plugin',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('aborts lock file maintenance if packageFileName is not build.gradle(.kts) in root project', async () => {
      expect(
        await updateArtifacts({
          packageFileName: 'somedir/settings.gradle',
          updatedDeps: [],
          newPackageFileContent: '',
          config: { isLockFileMaintenance: true },
        }),
      ).toBeNull();

      expect(logger.logger.trace).toHaveBeenCalledWith(
        'No build.gradle(.kts) file or not in root project - skipping lock file maintenance',
      );
    });

    it('performs lock file maintenance', async () => {
      const execSnapshots = mockExecAll();

      const res = await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [],
        newPackageFileContent: '',
        config: { isLockFileMaintenance: true },
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'gradle.lockfile',
            contents: 'New gradle.lockfile',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q properties',
          options: {
            cwd: '/tmp/github/some/repo',
          },
        },
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q :dependencies --write-locks',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('performs lock file maintenance (docker)', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });

      const res = await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [],
        newPackageFileContent: '',
        config: { isLockFileMaintenance: true },
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'gradle.lockfile',
            contents: 'New gradle.lockfile',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'docker pull ghcr.io/containerbase/sidecar' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e GRADLE_OPTS ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/containerbase/sidecar' +
            ' bash -l -c "' +
            'install-tool java 16.0.1' +
            ' && ' +
            './gradlew --console=plain --dependency-verification lenient -q properties' +
            '"',
          options: { cwd: '/tmp/github/some/repo' },
        },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e GRADLE_OPTS ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/containerbase/sidecar' +
            ' bash -l -c "' +
            'install-tool java 16.0.1' +
            ' && ' +
            './gradlew --console=plain --dependency-verification lenient -q :dependencies --write-locks' +
            '"',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('performs lock file maintenance (install)', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });

      const res = await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [],
        newPackageFileContent: '',
        config: { isLockFileMaintenance: true },
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'gradle.lockfile',
            contents: 'New gradle.lockfile',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool java 16.0.1' },
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q properties',
          options: { cwd: '/tmp/github/some/repo' },
        },
        { cmd: 'install-tool java 16.0.1' },
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q :dependencies --write-locks',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('updates all included projects', async () => {
      const execSnapshots = mockExecSequence([
        {
          stdout: "subprojects: [project ':sub1', project ':sub2']",
          stderr: '',
        },
        { stdout: '', stderr: '' },
      ]);

      const res = await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [],
        newPackageFileContent: '',
        config: { isLockFileMaintenance: true },
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'gradle.lockfile',
            contents: 'New gradle.lockfile',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q properties',
          options: {
            cwd: '/tmp/github/some/repo',
          },
        },
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q :dependencies :sub1:dependencies :sub2:dependencies --write-locks',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('does not update lockfile if content is unchanged', async () => {
      mockExecAll();
      fs.readLocalFile.mockResolvedValue('Current gradle.lockfile');

      expect(
        await updateArtifacts({
          packageFileName: 'build.gradle',
          updatedDeps: [],
          newPackageFileContent: '',
          config: { isLockFileMaintenance: true },
        }),
      ).toBeNull();
    });

    it('gradlew failed', async () => {
      const execSnapshots = mockExecAll(new Error('failed'));

      expect(
        await updateArtifacts({
          packageFileName: 'build.gradle',
          updatedDeps: [],
          newPackageFileContent: '',
          config: { isLockFileMaintenance: true },
        }),
      ).toEqual([
        {
          artifactError: {
            lockFile: 'build.gradle',
            stderr: 'failed',
          },
        },
      ]);

      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q properties',
          options: {
            cwd: '/tmp/github/some/repo',
          },
        },
      ]);
    });

    it('rethrows temporary error', async () => {
      const execError = new ExecError(TEMPORARY_ERROR, {
        cmd: '',
        stdout: '',
        stderr: '',
        options: { encoding: 'utf8' },
      });
      mockExecAll(execError);

      await expect(
        updateArtifacts({
          packageFileName: 'build.gradle',
          updatedDeps: [],
          newPackageFileContent: '{}',
          config: {},
        }),
      ).rejects.toThrow(TEMPORARY_ERROR);
    });

    it('fallback to default Java version if Gradle version not extractable', async () => {
      const execSnapshots = mockExecAll();
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });
      fs.readLocalFile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('New gradle.lockfile');

      const res = await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [],
        newPackageFileContent: '',
        config: { isLockFileMaintenance: true },
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'gradle.lockfile',
            contents: 'New gradle.lockfile',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool java 11.0.1' },
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q properties',
          options: { cwd: '/tmp/github/some/repo' },
        },
        { cmd: 'install-tool java 11.0.1' },
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q :dependencies --write-locks',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });
  });

  describe('dependency verification tests', () => {
    it('updates verification metadata file', async () => {
      const execSnapshots = mockExecAll();
      scm.getFileList.mockResolvedValue([
        'gradlew',
        'build.gradle',
        'gradle/wrapper/gradle-wrapper.properties',
        'gradle/verification-metadata.xml',
      ]);
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: ['build.gradle', 'gradle/verification-metadata.xml'],
        }),
      );

      const res = await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [
          { depName: 'org.junit.jupiter:junit-jupiter-api' },
          { depName: 'org.junit.jupiter:junit-jupiter-engine' },
        ],
        newPackageFileContent: '',
        config: {},
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'gradle/verification-metadata.xml',
            contents:
              '<verify-metadata>true</verify-metadata><sha256 value="hash" origin="test data"/>',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q --write-verification-metadata sha256 help',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('updates verification metadata and lock file', async () => {
      const execSnapshots = mockExecAll();
      scm.getFileList.mockResolvedValue([
        'gradlew',
        'build.gradle',
        'gradle.lockfile',
        'gradle/wrapper/gradle-wrapper.properties',
        'gradle/verification-metadata.xml',
      ]);
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: [
            'build.gradle',
            'gradle.lockfile',
            'gradle/verification-metadata.xml',
          ],
        }),
      );

      const res = await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [
          { depName: 'org.junit.jupiter:junit-jupiter-api' },
          { depName: 'org.junit.jupiter:junit-jupiter-engine' },
        ],
        newPackageFileContent: '',
        config: {},
      });

      expect(res).toEqual([
        {
          file: {
            type: 'addition',
            path: 'gradle.lockfile',
            contents: 'New gradle.lockfile',
          },
        },
        {
          file: {
            type: 'addition',
            path: 'gradle/verification-metadata.xml',
            contents:
              '<verify-metadata>true</verify-metadata><sha256 value="hash" origin="test data"/>',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q properties',
          options: {
            cwd: '/tmp/github/some/repo',
          },
        },
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q :dependencies --update-locks org.junit.jupiter:junit-jupiter-api,org.junit.jupiter:junit-jupiter-engine',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q --write-verification-metadata sha256 help',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('uses sha256 as default if only weak hash algorithms are found', async () => {
      const execSnapshots = mockExecAll();
      scm.getFileList.mockResolvedValue([
        'gradlew',
        'build.gradle',
        'gradle/wrapper/gradle-wrapper.properties',
        'gradle/verification-metadata.xml',
      ]);
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: ['build.gradle', 'gradle/verification-metadata.xml'],
        }),
      );
      fs.readLocalFile.mockImplementation((fileName: string): Promise<any> => {
        let content = '';
        if (fileName === 'gradle/verification-metadata.xml') {
          content =
            '<verify-metadata>true</verify-metadata><sha1 value="hash" origin="test data"/>';
        }
        return Promise.resolve(content);
      });

      await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [
          { depName: 'org.junit.jupiter:junit-jupiter-api' },
          { depName: 'org.junit.jupiter:junit-jupiter-engine' },
        ],
        newPackageFileContent: '',
        config: {},
      });

      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q --write-verification-metadata sha256 help',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('uses pgp hashType if verify-signatures is enabled', async () => {
      const execSnapshots = mockExecAll();
      scm.getFileList.mockResolvedValue([
        'gradlew',
        'build.gradle',
        'gradle/wrapper/gradle-wrapper.properties',
        'gradle/verification-metadata.xml',
      ]);
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: ['build.gradle', 'gradle/verification-metadata.xml'],
        }),
      );
      fs.readLocalFile.mockImplementation((fileName: string): Promise<any> => {
        let content = '';
        if (fileName === 'gradle/verification-metadata.xml') {
          content = '<verify-signatures>true</verify-signatures>';
        }
        return Promise.resolve(content);
      });

      await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [
          { depName: 'org.junit.jupiter:junit-jupiter-api' },
          { depName: 'org.junit.jupiter:junit-jupiter-engine' },
        ],
        newPackageFileContent: '',
        config: {},
      });

      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew --console=plain --dependency-verification lenient -q --write-verification-metadata sha256,pgp help',
          options: {
            cwd: '/tmp/github/some/repo',
            stdio: ['pipe', 'ignore', 'pipe'],
          },
        },
      ]);
    });

    it('does not exec any commands when verification metadata exists, but neither checksum nor signature verification is enabled', async () => {
      const execSnapshots = mockExecAll();
      scm.getFileList.mockResolvedValue([
        'gradlew',
        'build.gradle',
        'gradle/wrapper/gradle-wrapper.properties',
        'gradle/verification-metadata.xml',
      ]);
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: ['build.gradle', 'gradle/verification-metadata.xml'],
        }),
      );
      fs.readLocalFile.mockImplementation((fileName: string): Promise<any> => {
        let content = '';
        if (fileName === 'gradle/verification-metadata.xml') {
          content =
            '<verify-metadata>false</verify-metadata><verify-signatures>false</verify-signatures>';
        }
        return Promise.resolve(content);
      });

      await updateArtifacts({
        packageFileName: 'build.gradle',
        updatedDeps: [
          { depName: 'org.junit.jupiter:junit-jupiter-api' },
          { depName: 'org.junit.jupiter:junit-jupiter-engine' },
        ],
        newPackageFileContent: '',
        config: {},
      });

      expect(execSnapshots).toMatchObject([]);
    });
  });
});
