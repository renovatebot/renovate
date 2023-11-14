import type { Stats } from 'node:fs';
import os from 'node:os';
import { mockDeep } from 'jest-mock-extended';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import {
  env,
  fs,
  git,
  logger,
  mockedFunction,
  partial,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { resetPrefetchedImages } from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import { getPkgReleases } from '../../datasource';
import { updateArtifacts as gradleUpdateArtifacts } from '../gradle';
import type { UpdateArtifactsConfig, UpdateArtifactsResult } from '../types';
import { updateBuildFile, updateLockFiles } from './artifacts';
import { updateArtifacts } from '.';

jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/exec/env');
jest.mock('../../datasource', () => mockDeep());
jest.mock('../gradle');

process.env.CONTAINERBASE = 'true';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

const config: UpdateArtifactsConfig = {
  newValue: '5.6.4',
};

const osPlatformSpy = jest.spyOn(os, 'platform');

describe('modules/manager/gradle-wrapper/artifacts', () => {
  beforeEach(() => {
    osPlatformSpy.mockReturnValue('linux');
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });

    GlobalConfig.set(adminConfig);
    resetPrefetchedImages();

    fs.readLocalFile.mockResolvedValue('test');
    fs.statLocalFile.mockResolvedValue(
      partial<Stats>({
        isFile: () => true,
        mode: 0o555,
      }),
    );

    // java
    mockedFunction(getPkgReleases).mockResolvedValueOnce({
      releases: [
        { version: '8.0.1' },
        { version: '11.0.1' },
        { version: '16.0.1' },
        { version: '17.0.0' },
      ],
    });
  });

  describe('updateArtifacts()', () => {
    it('replaces existing value', async () => {
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: [
            'gradle/wrapper/gradle-wrapper.properties',
            'gradlew',
            'gradlew.bat',
          ],
        }),
      );

      const res = await updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: Fixtures.get(
          'expectedFiles/gradle/wrapper/gradle-wrapper.properties',
        ),
        config: { ...config, newValue: '6.3' },
      });

      expect(res).toEqual(
        [
          'gradle/wrapper/gradle-wrapper.properties',
          'gradlew',
          'gradlew.bat',
        ].map((fileProjectPath) => ({
          file: {
            type: 'addition',
            path: fileProjectPath,
            contents: 'test',
          },
        })),
      );
      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip',
          options: {
            cwd: '/tmp/github/some/repo',
            encoding: 'utf-8',
            env: {
              GRADLE_OPTS:
                '-Dorg.gradle.parallel=true -Dorg.gradle.configureondemand=true -Dorg.gradle.daemon=false -Dorg.gradle.caching=false',
            },
          },
        },
      ]);
    });

    it('gradlew not found', async () => {
      const execSnapshots = mockExecAll();
      fs.statLocalFile.mockResolvedValue(
        partial<Stats>({
          isFile: () => false,
          mode: 0o555,
        }),
      );

      const result = await updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: '',
        config: {},
      });

      expect(result).toBeNull();
      expect(execSnapshots).toBeEmptyArray();
    });

    it('gradlew failed', async () => {
      const execSnapshots = mockExecAll(new Error('failed'));
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: [],
        }),
      );
      const result = await updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      });

      expect(result).toBeEmptyArray();
      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew wrapper --gradle-version 5.6.4',
          options: { cwd: '/tmp/github/some/repo' },
        },
      ]);
    });

    it('updates distributionSha256Sum (docker)', async () => {
      const execSnapshots = mockExecAll();
      httpMock
        .scope('https://services.gradle.org')
        .get('/distributions/gradle-6.3-bin.zip.sha256')
        .reply(
          200,
          '038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768',
        );
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['gradle/wrapper/gradle-wrapper.properties'],
        }),
      );
      GlobalConfig.set({
        ...adminConfig,
        binarySource: 'docker',
        dockerSidecarImage: 'ghcr.io/containerbase/sidecar',
      });

      const result = await updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
        config,
      });

      expect(result).toEqual([
        {
          file: {
            contents: 'test',
            path: 'gradle/wrapper/gradle-wrapper.properties',
            type: 'addition',
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
            'install-tool java 11.0.1' +
            ' && ' +
            './gradlew wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip --gradle-distribution-sha256-sum 038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768' +
            '"',
          options: { cwd: '/tmp/github/some/repo' },
        },
      ]);
    });

    it('updates distributionSha256Sum (install)', async () => {
      const execSnapshots = mockExecAll();
      httpMock
        .scope('https://services.gradle.org')
        .get('/distributions/gradle-6.3-bin.zip.sha256')
        .reply(
          200,
          '038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768',
        );
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['gradle/wrapper/gradle-wrapper.properties'],
        }),
      );
      GlobalConfig.set({ ...adminConfig, binarySource: 'install' });

      const result = await updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
        config,
      });

      expect(result).toEqual([
        {
          file: {
            contents: 'test',
            path: 'gradle/wrapper/gradle-wrapper.properties',
            type: 'addition',
          },
        },
      ]);
      expect(execSnapshots).toMatchObject([
        { cmd: 'install-tool java 11.0.1' },
        {
          cmd: './gradlew wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip --gradle-distribution-sha256-sum 038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768',
          options: { cwd: '/tmp/github/some/repo' },
        },
      ]);
    });

    it('distributionSha256Sum 404', async () => {
      const execSnapshots = mockExecAll();
      httpMock
        .scope('https://services.gradle.org')
        .get('/distributions/gradle-6.3-bin.zip.sha256')
        .reply(404);

      const result = await updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
        config,
      });

      expect(result).toEqual([
        {
          artifactError: {
            lockFile: 'gradle/wrapper/gradle-wrapper.properties',
            stderr: 'Response code 404 (Not Found)',
          },
        },
      ]);
      expect(execSnapshots).toBeEmptyArray();
    });

    it('handles gradle-wrapper in subdirectory', async () => {
      const execSnapshots = mockExecAll();
      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: [
            'sub/gradle/wrapper/gradle-wrapper.properties',
            'sub/gradlew',
            'sub/gradlew.bat',
          ],
        }),
      );

      const res = await updateArtifacts({
        packageFileName: 'sub/gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: Fixtures.get(
          'expectedFiles/gradle/wrapper/gradle-wrapper.properties',
        ),
        config: { ...config, newValue: '6.3' },
      });

      expect(res).toEqual(
        [
          'sub/gradle/wrapper/gradle-wrapper.properties',
          'sub/gradlew',
          'sub/gradlew.bat',
        ].map((fileProjectPath) => ({
          file: {
            type: 'addition',
            path: fileProjectPath,
            contents: 'test',
          },
        })),
      );
      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip',
          options: {
            cwd: '/tmp/github/some/repo/sub',
            encoding: 'utf-8',
            env: {
              GRADLE_OPTS:
                '-Dorg.gradle.parallel=true -Dorg.gradle.configureondemand=true -Dorg.gradle.daemon=false -Dorg.gradle.caching=false',
            },
          },
        },
      ]);
    });
  });

  describe('updateBuildFile()', () => {
    it('updates wrapper configuration in gradle build file', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
            tasks.named("wrapper", Wrapper::class) {
              gradleVersion = '5.6.2'
              distributionSha256Sum="027fdd265d277bae65a0d349b6b8da02135b0b8e14ba891e26281fa877fe37a2"
              distributionUrl = "https://services.gradle.org/distributions/gradle-5.6.2-bin.zip"
            }`);

      fs.writeLocalFile.mockImplementationOnce(
        (fileName: string, fileContent: string | Buffer): Promise<void> => {
          expect(fileContent).toBe(`
            tasks.named("wrapper", Wrapper::class) {
              gradleVersion = '6.3'
              distributionSha256Sum="038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768"
              distributionUrl = "https://services.gradle.org/distributions/gradle-6.3-bin.zip"
            }`);
          return Promise.resolve();
        },
      );

      const res = await updateBuildFile('', {
        gradleVersion: '6.3',
        distributionSha256Sum:
          '038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768',
        distributionUrl:
          'https://services.gradle.org/distributions/gradle-6.3-bin.zip',
      });
      expect(res).toBe('build.gradle.kts');
    });

    it('gradle build file update skips missing distributionSha256Sum property', async () => {
      fs.localPathExists.mockResolvedValueOnce(true);
      fs.readLocalFile.mockResolvedValueOnce(`
            wrapper {
              gradleVersion = '5.6.2'
              distributionUrl = "https://services.gradle.org/distributions/gradle-$gradleVersion-all.zip"
            }`);

      fs.writeLocalFile.mockImplementationOnce(
        (fileName: string, fileContent: string | Buffer): Promise<void> => {
          expect(fileContent).toBe(`
            wrapper {
              gradleVersion = '6.3'
              distributionUrl = "https://services.gradle.org/distributions/gradle-$gradleVersion-all.zip"
            }`);
          return Promise.resolve();
        },
      );

      const res = await updateBuildFile('', {
        gradleVersion: '6.3',
        distributionSha256Sum: null,
        distributionUrl:
          'https://services.gradle.org/distributions/gradle-6.3-bin.zip',
      });
      expect(res).toBe('build.gradle');
    });

    it('gradle build file update returns early if file not found', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);

      const res = await updateBuildFile('', {
        gradleVersion: '6.3',
        distributionSha256Sum:
          '038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768',
        distributionUrl:
          'https://services.gradle.org/distributions/gradle-6.3-bin.zip',
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'build.gradle or build.gradle.kts not found',
      );
      expect(res).toBe('build.gradle.kts');
    });
  });

  describe('updateLockFiles()', () => {
    it('returns early if build script file not found', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);

      const res = await updateLockFiles('', {});
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'build.gradle or build.gradle.kts not found',
      );
      expect(res).toBeNull();
    });

    it('includes gradle lockfile in result', async () => {
      const execSnapshots = mockExecAll();
      const updatedArtifacts: UpdateArtifactsResult[] = [
        {
          file: {
            type: 'addition',
            path: 'gradle.lockfile',
            contents: 'test',
          },
        },
      ];
      mockedFunction(gradleUpdateArtifacts).mockResolvedValue(updatedArtifacts);

      git.getRepoStatus.mockResolvedValue(
        partial<StatusResult>({
          modified: ['gradle.lockfile'],
        }),
      );

      const res = await updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: '',
        config: { ...config, newValue: '8.2' },
      });

      expect(res).toStrictEqual(updatedArtifacts);
      expect(execSnapshots).toMatchObject([
        {
          cmd: './gradlew wrapper --gradle-version 8.2',
        },
      ]);
    });
  });
});
