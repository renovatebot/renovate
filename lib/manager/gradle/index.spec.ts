import { toUnix } from 'upath';
import _fs from 'fs-extra';
import fsReal, { Stats } from 'fs';
import { exec as _exec } from 'child_process';
import * as _os from 'os';
import tmp, { DirectoryResult } from 'tmp-promise';
import * as path from 'path';
import { platform as _platform } from '../../platform';
import { envMock, mockExecAll } from '../../../test/execUtil';
import * as _env from '../../util/exec/env';
import { BinarySource } from '../../util/exec/common';
import * as _docker from '../../util/exec/docker';
import * as _util from '../../util';
import { ifSystemSupportsGradle } from './__testutil__/gradle';
import * as _manager from '.';
import { ExtractConfig } from '../common';

const fixtures = 'lib/manager/gradle/__fixtures__';

const config = {
  localDir: 'localDir',
  gradle: {
    timeout: 20,
  },
};

const updatesDependenciesReport = fsReal.readFileSync(
  'lib/manager/gradle/__fixtures__/updatesReport.json',
  'utf8'
);

const gradleOutput = {
  stdout: 'gradle output',
  stderr: '',
};

function resetMocks() {
  jest.resetAllMocks();
  jest.resetModules();
}

async function setupMocks() {
  resetMocks();

  jest.mock('fs-extra');
  jest.mock('child_process');
  jest.mock('../../util/exec/env');
  jest.mock('../../platform');
  jest.mock('os');

  const fs: jest.Mocked<typeof _fs> = require('fs-extra');
  const os: jest.Mocked<typeof _os> = require('os');
  const platform: jest.Mocked<typeof _platform> = require('../../platform')
    .platform;
  const env: jest.Mocked<typeof _env> = require('../../util/exec/env');
  const exec: jest.Mock<typeof _exec> = require('child_process').exec;
  const util: jest.Mocked<typeof _util> = require('../../util');

  platform.getFile.mockResolvedValue('some content');
  env.getChildProcessEnv.mockReturnValue(envMock.basic);
  await util.setUtilConfig(config);

  return [require('.'), exec, fs, util, os];
}

describe('manager/gradle', () => {
  describe('extractPackageFile', () => {
    let manager: typeof _manager;
    let exec: jest.Mock<typeof _exec>;
    let fs: jest.Mocked<typeof _fs>;
    let util: jest.Mocked<typeof _util>;
    let os: jest.Mocked<typeof _os>;
    let docker: typeof _docker;

    beforeAll(async () => {
      [manager, exec, fs, util, os] = await setupMocks();
      docker = require('../../util/exec/docker');
    });

    afterAll(resetMocks);

    beforeEach(() => {
      fs.readFile.mockResolvedValue(updatesDependenciesReport as any);
      fs.mkdir.mockResolvedValue();
      fs.exists.mockResolvedValue(true);
      fs.stat.mockResolvedValue({
        mode: 0o755,
        isFile: () => true,
      } as Stats);
      exec.mockReset();
      docker.resetPrefetchedImages();
      os.platform.mockReturnValue('linux');
    });

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

      fs.readFile.mockResolvedValue(
        fsReal.readFileSync(
          'lib/manager/gradle/__fixtures__/updatesReportEmpty.json',
          'utf8'
        ) as any
      );
      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);

      expect(dependencies).toEqual([]);
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
        'lib/manager/gradle/__fixtures__/MultiProjectUpdatesReport.json',
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
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradlew.bat when available on Windows', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      os.platform.mockReturnValue('win32');

      await manager.extractAllPackageFiles(config, ['build.gradle']);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradle if gradlew is not available', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      fs.stat.mockResolvedValue({ isFile: () => false } as Stats);
      await manager.extractAllPackageFiles(config, ['build.gradle']);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return null and gradle should not be executed if no root build.gradle', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      fs.stat.mockResolvedValue({ isFile: () => false } as Stats);

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
      util.setUtilConfig({ ...config, binarySource: BinarySource.Docker });
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const configWithDocker = {
        binarySource: BinarySource.Docker,
        ...config,
      };
      await manager.extractAllPackageFiles(configWithDocker, ['build.gradle']);

      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker even if gradlew is available', async () => {
      util.setUtilConfig({ ...config, binarySource: BinarySource.Docker });
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const configWithDocker = {
        binarySource: BinarySource.Docker,
        ...config,
        gradle: {},
      };
      await manager.extractAllPackageFiles(configWithDocker, ['build.gradle']);

      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker even if gradlew.bat is available on Windows', async () => {
      os.platform.mockReturnValue('win32');
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const configWithDocker = {
        binarySource: BinarySource.Docker,
        ...config,
        gradle: {},
      };
      await manager.extractAllPackageFiles(configWithDocker, ['build.gradle']);

      expect(execSnapshots).toMatchSnapshot();
    });
  });

  describe('updateDependency', () => {
    let manager: typeof _manager;
    let exec: jest.Mock<typeof _exec>;

    beforeAll(async () => {
      [manager, exec] = await setupMocks();
    });
    afterAll(resetMocks);

    it('should update an existing module dependency', () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = fsReal.readFileSync(
        'lib/manager/gradle/__fixtures__/build.gradle.example1',
        'utf8'
      );
      // prettier-ignore
      const upgrade = {
        depGroup: 'cglib', name: 'cglib-nodep', version: '3.1', newValue: '3.2.8',
      };
      const buildGradleContentUpdated = manager.updateDependency({
        fileContent: buildGradleContent,
        upgrade,
      });

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
      const buildGradleContentUpdated = manager.updateDependency({
        fileContent: buildGradleContent,
        upgrade,
      });

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
      const buildGradleContentUpdated = manager.updateDependency({
        fileContent: buildGradleContent,
        upgrade,
      });

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

  describe('executeGradle integration', () => {
    const SUCCESS_FILE = 'success.indicator';
    let workingDir: DirectoryResult;
    let testRunConfig: ExtractConfig;

    const manager = require('.');

    beforeEach(async () => {
      workingDir = await tmp.dir({ unsafeCleanup: true });
      testRunConfig = { ...config, localDir: workingDir.path };
      await _fs.copy(`${fixtures}/minimal-project`, workingDir.path);
      await _fs.copy(`${fixtures}/gradle-wrappers/6`, workingDir.path);

      const mockPluginContent = `
allprojects {
  tasks.register("renovate") {
    doLast {
      new File('${SUCCESS_FILE}').write 'success'
    }
  }
}`;
      await _fs.writeFile(
        path.join(workingDir.path, 'renovate-plugin.gradle'),
        mockPluginContent
      );
    });

    ifSystemSupportsGradle(6).it(
      'executes an executable gradle wrapper',
      async () => {
        const gradlew = await fsReal.promises.stat(
          path.join(workingDir.path, 'gradlew')
        );
        await manager.executeGradle(testRunConfig, workingDir.path, gradlew);
        await expect(
          fsReal.promises.readFile(
            path.join(workingDir.path, SUCCESS_FILE),
            'utf8'
          )
        ).resolves.toBe('success');
      },
      120000
    );

    ifSystemSupportsGradle(6).it(
      'executes a not-executable gradle wrapper',
      async () => {
        await fsReal.promises.chmod(
          path.join(workingDir.path, 'gradlew'),
          '444'
        );
        const gradlew = await fsReal.promises.stat(
          path.join(workingDir.path, 'gradlew')
        );
        await manager.executeGradle(testRunConfig, workingDir.path, gradlew);
        await expect(
          fsReal.promises.readFile(
            path.join(workingDir.path, SUCCESS_FILE),
            'utf8'
          )
        ).resolves.toBe('success');
      },
      120000
    );
  });
});
