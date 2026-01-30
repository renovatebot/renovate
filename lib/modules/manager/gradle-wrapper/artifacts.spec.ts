import type { Stats } from 'node:fs';
import os from 'node:os';
import upath from 'upath';
import { mockDeep } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global.ts';
import type { RepoGlobalConfig } from '../../../config/types.ts';
import { resetPrefetchedImages } from '../../../util/exec/docker/index.ts';
import type { StatusResult } from '../../../util/git/types.ts';
import { getPkgReleases } from '../../datasource/index.ts';
import { updateArtifacts as gradleUpdateArtifacts } from '../gradle/index.ts';
import type { UpdateArtifactsConfig, UpdateArtifactsResult } from '../types.ts';
import {
  getGradleWrapperOptions,
  gradleJvmArg,
  updateBuildFile,
  updateLockFiles,
} from './artifacts.ts';
import { updateArtifacts } from './index.ts';
import { envMock, mockExecAll } from '~test/exec-util.ts';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { env, fs, git, logger, partial } from '~test/util.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../../../util/exec/env.ts');
vi.mock('../../datasource/index.ts', () => mockDeep());
vi.mock('../gradle/index.ts');

process.env.CONTAINERBASE = 'true';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: upath.join('/tmp/github/some/repo'),
  cacheDir: upath.join('/tmp/cache'),
  containerbaseDir: upath.join('/tmp/cache/containerbase'),

  // although not enabled by default, let's assume it is
  allowedUnsafeExecutions: ['gradleWrapper'],
};

const config: UpdateArtifactsConfig = {
  newValue: '5.6.4',
};

const osPlatformSpy = vi.spyOn(os, 'platform');

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

    // remove any test-specific overrides
    delete config.gradleWrapper;

    fs.readLocalFile.mockResolvedValue('test');
    fs.statLocalFile.mockResolvedValue(
      partial<Stats>({
        isFile: () => true,
        mode: 0o555,
      }),
    );

    // java
    vi.mocked(getPkgReleases).mockResolvedValueOnce({
      releases: [
        { version: '8.0.1' },
        { version: '11.0.1' },
        { version: '16.0.1' },
        { version: '17.0.0' },
      ],
    });
  });

  describe('getGradleWrapperOptions()', () => {
    beforeEach(() => {
      GlobalConfig.set({
        ...adminConfig,
        gradleWrapper: { jvmMemory: 256, jvmMaxMemory: 300 },
      });
    });

    it('returns default values if no global or repo config', () => {
      GlobalConfig.set({
        ...adminConfig,
      });

      const res = getGradleWrapperOptions(undefined);

      expect(res).toEqual({
        jvmMemory: 256,
        jvmMaxMemory: 256,
      });
    });

    describe('does not allow floating point numbers', () => {
      it('in global config', () => {
        GlobalConfig.set({
          ...adminConfig,
          gradleWrapper: { jvmMemory: 256.5, jvmMaxMemory: 300.2 },
        });

        const res = getGradleWrapperOptions(undefined);

        expect(res).toEqual({
          jvmMemory: 256,
          jvmMaxMemory: 300,
        });
      });

      it('in repo config', () => {
        config.gradleWrapper = {
          jvmMemory: 128.8,
          jvmMaxMemory: 200.4,
        };

        const res = getGradleWrapperOptions(config.gradleWrapper);

        expect(res).toEqual({
          jvmMemory: 128,
          jvmMaxMemory: 200,
        });
      });
    });

    describe('when using repo config to override memory limits', () => {
      it('when below global settings, repo settings are used', () => {
        config.gradleWrapper = {
          jvmMemory: 128,
          jvmMaxMemory: 200,
        };

        const res = getGradleWrapperOptions(config.gradleWrapper);

        expect(res).toEqual({
          jvmMemory: 128,
          jvmMaxMemory: 200,
        });
      });

      it('when repo settings are the same as global settings, they are used', () => {
        config.gradleWrapper = {
          jvmMemory: 256,
          jvmMaxMemory: 300,
        };

        const res = getGradleWrapperOptions(config.gradleWrapper);

        expect(res).toEqual({
          jvmMemory: 256,
          jvmMaxMemory: 300,
        });
      });

      it('when repo jvmMemory setting is higher than global setting, but lower than global jvmMaxMemory, the repo config is used', () => {
        config.gradleWrapper = {
          jvmMemory: 150,
        };

        const res = getGradleWrapperOptions(config.gradleWrapper);

        expect(res).toMatchObject({
          jvmMemory: 150,
        });
      });

      it('when repo jvmMaxMemory setting is lower than global settings, it is applied', () => {
        config.gradleWrapper = {
          jvmMaxMemory: 190,
        };

        const res = getGradleWrapperOptions(config.gradleWrapper);

        expect(res).toMatchObject({
          jvmMaxMemory: 190,
        });
      });

      it('when repo jvmMaxMemory setting is lower than global jvmMemory, jvmMemory is set to the same value', () => {
        config.gradleWrapper = {
          jvmMaxMemory: 200,
        };

        const res = getGradleWrapperOptions(config.gradleWrapper);

        expect(res).toEqual({
          jvmMemory: 200,
          jvmMaxMemory: 200,
        });
      });

      it('when repo jvmMaxMemory setting is lower than repo jvmMemory, jvmMemory is set to the same value', () => {
        config.gradleWrapper = {
          jvmMemory: 150,
          jvmMaxMemory: 150,
        };

        const res = getGradleWrapperOptions(config.gradleWrapper);

        expect(res).toEqual({
          jvmMemory: 150,
          jvmMaxMemory: 150,
        });
      });

      it('when repo jvmMaxMemory setting is higher than global settings, they are ignored', () => {
        config.gradleWrapper = {
          jvmMaxMemory: 8192,
        };

        const res = getGradleWrapperOptions(config.gradleWrapper);

        expect(res).toEqual({
          jvmMemory: 256,
          jvmMaxMemory: 300,
        });
      });

      it('when repo jvmMaxMemory setting is higher than global settings, a debug log is logged', () => {
        config.gradleWrapper = {
          jvmMaxMemory: 8192,
        };

        getGradleWrapperOptions(config.gradleWrapper);

        expect(logger.logger.once.debug).toHaveBeenCalledWith(
          'A higher jvmMaxMemory (8192) than the global configuration (300) is not permitted for Gradle Wrapper invocations. Using global configuration instead',
        );
      });
    });

    // to provide a bit more safety to users, so they can't specify too little memory for Gradle
    describe('a minimum of 128M is enforced', () => {
      it('when global settings are lower than 128M, they are overridden to 128M', () => {
        GlobalConfig.set({
          ...adminConfig,
          gradleWrapper: { jvmMemory: 100, jvmMaxMemory: 127 },
        });

        const res = getGradleWrapperOptions(undefined);

        expect(res).toEqual({
          jvmMemory: 128,
          jvmMaxMemory: 128,
        });
      });

      it('when global settings are lower than 128M, a debug log is logged', () => {
        GlobalConfig.set({
          ...adminConfig,
          gradleWrapper: { jvmMemory: 100, jvmMaxMemory: 127 },
        });

        getGradleWrapperOptions(undefined);

        expect(logger.logger.once.debug).toHaveBeenCalledWith(
          'Overriding low memory settings for Gradle Wrapper invocations to a minimum of 128M',
        );
      });

      it('when repo settings are lower than 128M, they are overridden to 128M', () => {
        config.gradleWrapper = {
          jvmMemory: 100,
          jvmMaxMemory: 127,
        };

        const res = getGradleWrapperOptions(config.gradleWrapper);

        expect(res).toEqual({
          jvmMemory: 128,
          jvmMaxMemory: 128,
        });
      });

      it('when repo settings are lower than 128M, a debug log is logged', () => {
        config.gradleWrapper = {
          jvmMemory: 100,
          jvmMaxMemory: 127,
        };

        getGradleWrapperOptions(config.gradleWrapper);

        expect(logger.logger.once.debug).toHaveBeenCalledWith(
          'Overriding low memory settings for Gradle Wrapper invocations to a minimum of 128M',
        );
      });
    });
  });

  describe('gradleJvmArg()', () => {
    it('takes the values given to it, and returns the JVM arguments', () => {
      const result = gradleJvmArg({ jvmMemory: 128, jvmMaxMemory: 384 });
      expect(result).toBe(' -Dorg.gradle.jvmargs="-Xms128m -Xmx384m"');
    });
  });

  describe('updateArtifacts()', () => {
    it('Custom Gradle Wrapper heap settings are populated', async () => {
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
        gradleWrapper: { jvmMaxMemory: 300 },
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
        {
          cmd: './gradlew -Dorg.gradle.jvmargs="-Xms300m -Xmx300m" :wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip --gradle-distribution-sha256-sum 038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768',
        },
      ]);
    });

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
          cmd: './gradlew -Dorg.gradle.jvmargs="-Xms256m -Xmx256m" :wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip',
          options: {
            cwd: '/tmp/github/some/repo',
            env: {
              GRADLE_OPTS:
                '-Dorg.gradle.parallel=true -Dorg.gradle.configureondemand=true -Dorg.gradle.daemon=false -Dorg.gradle.caching=false',
            },
          },
        },
      ]);
    });

    it('aborts if allowedUnsafeExecutions does not include `gradleWrapper`', async () => {
      GlobalConfig.set({
        ...adminConfig,
        allowedUnsafeExecutions: [],
      });

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

      expect(res).toBeNull();
      expect(execSnapshots).toBeEmptyArray();
      expect(logger.logger.trace).toHaveBeenCalledWith(
        'Not allowed to execute gradle due to allowedUnsafeExecutions - aborting update',
      );
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
          cmd: './gradlew -Dorg.gradle.jvmargs="-Xms256m -Xmx256m" :wrapper --gradle-version 5.6.4',
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
        dockerSidecarImage: 'ghcr.io/renovatebot/base-image',
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
        { cmd: 'docker pull ghcr.io/renovatebot/base-image' },
        { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
        {
          cmd:
            'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
            '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
            '-v "/tmp/cache":"/tmp/cache" ' +
            '-e GRADLE_OPTS ' +
            '-e CONTAINERBASE_CACHE_DIR ' +
            '-w "/tmp/github/some/repo" ' +
            'ghcr.io/renovatebot/base-image' +
            ' bash -l -c "' +
            'install-tool java 11.0.1' +
            ' && ' +
            './gradlew -Dorg.gradle.jvmargs=\\"-Xms256m -Xmx256m\\" :wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip --gradle-distribution-sha256-sum 038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768' +
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
          cmd: './gradlew -Dorg.gradle.jvmargs="-Xms256m -Xmx256m" :wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip --gradle-distribution-sha256-sum 038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768',
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
          cmd: './gradlew -Dorg.gradle.jvmargs="-Xms256m -Xmx256m" :wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip',
          options: {
            cwd: '/tmp/github/some/repo/sub',
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
      vi.mocked(gradleUpdateArtifacts).mockResolvedValue(updatedArtifacts);

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
          cmd: './gradlew -Dorg.gradle.jvmargs="-Xms256m -Xmx256m" :wrapper --gradle-version 8.2',
        },
      ]);
    });
  });
});
