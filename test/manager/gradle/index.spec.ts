import { toUnix } from 'upath';
import _fs from 'fs-extra';
import fsReal from 'fs';
import { exec as _exec } from 'child_process';
import * as manager from '../../../lib/manager/gradle';
import { platform as _platform, Platform } from '../../../lib/platform';
import { envMock, mockExecAll } from '../../execUtil';
import * as _env from '../../../lib/util/exec/env';
import { mocked } from '../../util';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../lib/util/exec/env');

const platform: jest.Mocked<Platform> = _platform as any;
const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

const config = {
  localDir: 'localDir',
  gradle: {
    timeout: 20,
  },
};

const updatesDependenciesReport = fsReal.readFileSync(
  'test/datasource/gradle/_fixtures/updatesReport.json',
  'utf8'
);

const gradleOutput = {
  stdout: 'gradle output',
  stderr: '',
};

describe('manager/gradle', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    fs.readFile.mockResolvedValue(updatesDependenciesReport as any);
    fs.mkdir.mockResolvedValue();
    fs.exists.mockResolvedValue(true);
    fs.access.mockResolvedValue(undefined);
    platform.getFile.mockResolvedValue('some content');

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });

  describe('extractPackageFile', () => {
    it('should return gradle dependencies', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
        'subproject/build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return gradle.kts dependencies', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle.kts',
        'subproject/build.gradle.kts',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if there are no dependencies', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      fs.readFile.mockResolvedValue(fsReal.readFileSync(
        'test/datasource/gradle/_fixtures/updatesReportEmpty.json',
        'utf8'
      ) as any);
      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);

      expect(dependencies).toEqual([]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should throw registry failure if gradle execution fails', async () => {
      const execSnapshots = mockExecAll(exec, new Error());

      await expect(
        manager.extractAllPackageFiles(config, ['build.gradle'])
      ).rejects.toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if there is no dependency report', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      fs.exists.mockResolvedValue(false);
      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);

      expect(dependencies).toEqual([]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if renovate report is invalid', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const renovateReport = `
        Invalid JSON]
      `;
      fs.readFile.mockResolvedValue(renovateReport as any);

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toEqual([]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use repositories only for current project', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const multiProjectUpdatesReport = fsReal.readFileSync(
        'test/datasource/gradle/_fixtures/MultiProjectUpdatesReport.json',
        'utf8'
      );
      fs.readFile.mockResolvedValue(multiProjectUpdatesReport as any);

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradlew when available', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      await manager.extractAllPackageFiles(config, ['build.gradle']);

      expect(exec.mock.calls[0][0]).toBe(
        './gradlew --init-script renovate-plugin.gradle renovate'
      );
      expect(exec.mock.calls[0][1]).toMatchObject({
        cwd: 'localDir',
        timeout: 20000,
      });
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should run gradlew through `sh` when available but not executable', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      fs.access.mockRejectedValue(undefined);
      await manager.extractAllPackageFiles(config, ['build.gradle']);

      expect(exec.mock.calls[0][0]).toBe(
        'sh gradlew --init-script renovate-plugin.gradle renovate'
      );
      expect(exec.mock.calls[0][1]).toMatchObject({
        cwd: 'localDir',
        timeout: 20000,
      });
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return null and gradle should not be executed if no root build.gradle', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      fs.exists.mockResolvedValue(false);

      const packageFiles = ['foo/build.gradle'];
      expect(
        await manager.extractAllPackageFiles(config, packageFiles)
      ).toBeNull();

      expect(exec).toHaveBeenCalledTimes(0);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return gradle dependencies for build.gradle in subdirectories if there is gradlew in the same directory', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const dependencies = await manager.extractAllPackageFiles(config, [
        'foo/build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should configure the renovate report plugin', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      await manager.extractAllPackageFiles(config, ['build.gradle']);

      expect(toUnix(fs.writeFile.mock.calls[0][0] as string)).toBe(
        'localDir/renovate-plugin.gradle'
      );
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker if required', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const configWithDocker = {
        binarySource: 'docker',
        ...config,
      };
      await manager.extractAllPackageFiles(configWithDocker, ['build.gradle']);

      expect(exec.mock.calls[0][0].includes('docker run')).toBe(true);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker even if gradlew is available', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const configWithDocker = {
        binarySource: 'docker',
        ...config,
        gradle: {},
      };
      await manager.extractAllPackageFiles(configWithDocker, ['build.gradle']);

      expect(exec.mock.calls[0][0].includes('docker run')).toBe(true);
      expect(execSnapshots).toMatchSnapshot();
    });
  });

  describe('updateDependency', () => {
    it('should update an existing module dependency', () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = fsReal.readFileSync(
        'test/datasource/gradle/_fixtures/build.gradle.example1',
        'utf8'
      );
      // prettier-ignore
      const upgrade = {
        depGroup: 'cglib', name: 'cglib-nodep', version: '3.1', newValue: '3.2.8'
      };
      const buildGradleContentUpdated = manager.updateDependency(
        buildGradleContent,
        upgrade
      );

      expect(buildGradleContent).not.toMatch('cglib:cglib-nodep:3.2.8');

      expect(buildGradleContentUpdated).toMatch('cglib:cglib-nodep:3.2.8');
      expect(buildGradleContentUpdated).not.toMatch('cglib:cglib-nodep:3.1');

      expect(execSnapshots).toMatchSnapshot();
    });

    it('should update an existing plugin dependency', () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = `
        plugins {
            id "com.github.ben-manes.versions" version "0.20.0"
        }
        `;
      const upgrade = {
        depGroup: 'com.github.ben-manes.versions',
        name: 'com.github.ben-manes.versions.gradle.plugin',
        version: '0.20.0',
        newValue: '0.21.0',
      };
      const buildGradleContentUpdated = manager.updateDependency(
        buildGradleContent,
        upgrade
      );

      expect(buildGradleContent).not.toMatch(
        'id "com.github.ben-manes.versions" version "0.21.0"'
      );

      expect(buildGradleContentUpdated).toMatch(
        'id "com.github.ben-manes.versions" version "0.21.0"'
      );
      expect(buildGradleContentUpdated).not.toMatch(
        'id "com.github.ben-manes.versions" version "0.20.0"'
      );

      expect(execSnapshots).toMatchSnapshot();
    });

    it('should update an existing plugin dependency with Kotlin DSL', () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = `
        plugins {
            id("com.github.ben-manes.versions") version "0.20.0"
        }
        `;
      const upgrade = {
        depGroup: 'com.github.ben-manes.versions',
        name: 'com.github.ben-manes.versions.gradle.plugin',
        version: '0.20.0',
        newValue: '0.21.0',
      };
      const buildGradleContentUpdated = manager.updateDependency(
        buildGradleContent,
        upgrade
      );

      expect(buildGradleContent).not.toMatch(
        'id("com.github.ben-manes.versions") version "0.21.0"'
      );

      expect(buildGradleContentUpdated).toMatch(
        'id("com.github.ben-manes.versions") version "0.21.0"'
      );
      expect(buildGradleContentUpdated).not.toMatch(
        'id("com.github.ben-manes.versions") version "0.20.0"'
      );

      expect(execSnapshots).toMatchSnapshot();
    });
  });
});
