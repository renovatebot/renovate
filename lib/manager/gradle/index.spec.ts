import { exec as _exec } from 'child_process';
import os from 'os';
import fsExtra from 'fs-extra';
import tmp from 'tmp-promise';
import * as upath from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import {
  addReplacingSerializer,
  getName,
  replacingSerializer,
} from '../../../test/util';
import * as _util from '../../util';
import { BinarySource } from '../../util/exec/common';
import * as _docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import * as _fs from '../../util/fs';
import type { ExtractConfig } from '../types';
import { GRADLE_DEPENDENCY_REPORT_FILENAME } from './gradle-updates-report';
import * as _manager from '.';

const fixtures = 'lib/manager/gradle/__fixtures__';
const standardUpdatesReport = () =>
  fsExtra.readFile(`${fixtures}/updatesReport.json`, 'utf8');
const emptyUpdatesReport = () =>
  fsExtra.readFile(`${fixtures}/updatesReportEmpty.json`, 'utf8');
const multiProjectUpdatesReport = () =>
  fsExtra.readFile(`${fixtures}/MultiProjectUpdatesReport.json`, 'utf8');

const baseConfig = {
  gradle: {
    timeout: 60,
  },
};

const gradleOutput = {
  stdout: 'gradle output',
  stderr: '',
};

addReplacingSerializer('gradlew.bat', '<gradlew>');
addReplacingSerializer('./gradlew', '<gradlew>');

function resetMocks() {
  jest.resetAllMocks();
  jest.resetModules();
}

async function setupMocks() {
  resetMocks();

  jest.mock('child_process');
  jest.mock('../../util/exec/env');
  jest.mock('../../util/fs');

  const fs: jest.Mocked<typeof _fs> = require('../../util/fs');
  const env: jest.Mocked<typeof _env> = require('../../util/exec/env');
  const exec: jest.Mock<typeof _exec> = require('child_process').exec;
  const util: jest.Mocked<typeof _util> = require('../../util');

  fs.readLocalFile.mockResolvedValue(`
    dependency 'foo:foo:1.2.3'
    dependency "bar:bar:This.Is.Valid.Version.Good.Luck"
    dependency "baz:baz:\${bazVersion}"
  `);
  env.getChildProcessEnv.mockReturnValue(envMock.basic);
  await util.setUtilConfig(baseConfig);

  return [require('.'), exec, util];
}

describe(getName(__filename), () => {
  describe('extractPackageFile', () => {
    let manager: typeof _manager;
    let exec: jest.Mock<typeof _exec>;
    let util: jest.Mocked<typeof _util>;
    let docker: typeof _docker;
    let config: ExtractConfig;

    beforeAll(async () => {
      [manager, exec, util] = await setupMocks();
      docker = require('../../util/exec/docker');
    });

    afterAll(resetMocks);

    beforeEach(async () => {
      exec.mockReset();
      docker.resetPrefetchedImages();

      const gradleDir = await tmp.dir({ unsafeCleanup: true });
      config = { ...baseConfig, localDir: gradleDir.path };
      expect.addSnapshotSerializer(
        replacingSerializer(upath.toUnix(gradleDir.path), 'localDir')
      );
    });

    async function initializeWorkingDir(
      addGradleWrapper: boolean,
      updatesReport: Promise<string> | string | null,
      dir: string = config.localDir
    ) {
      if (addGradleWrapper) {
        await fsExtra.copy(`${fixtures}/gradle-wrappers/6`, dir);
      }
      if (updatesReport) {
        await fsExtra.writeFile(
          `${dir}/${GRADLE_DEPENDENCY_REPORT_FILENAME}`,
          await updatesReport
        );
      }
    }

    it('should return gradle dependencies', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(true, standardUpdatesReport());

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
        'subproject/build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return gradle.kts dependencies', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(true, standardUpdatesReport());

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle.kts',
        'subproject/build.gradle.kts',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if there are no dependencies', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(true, emptyUpdatesReport());

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);

      expect(dependencies).toEqual([]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if there is no dependency report', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(true, null);

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);

      expect(dependencies).toEqual([]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if renovate report is invalid', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(
        true,
        `
        Invalid JSON]
      `
      );

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toEqual([]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use repositories only for current project', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(true, multiProjectUpdatesReport());

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradlew when available', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(true, standardUpdatesReport());

      await manager.extractAllPackageFiles(config, ['build.gradle']);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradlew.bat when available on Windows', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(true, standardUpdatesReport());

      jest.spyOn(os, 'platform').mockReturnValueOnce('win32');

      await manager.extractAllPackageFiles(config, ['build.gradle']);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradle if gradlew is not available', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(false, standardUpdatesReport());

      await manager.extractAllPackageFiles(config, ['build.gradle']);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return null and gradle should not be executed if no root build.gradle', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(false, null);

      const packageFiles = ['foo/build.gradle'];
      expect(
        await manager.extractAllPackageFiles(config, packageFiles)
      ).toBeNull();

      expect(exec).toHaveBeenCalledTimes(0);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return gradle dependencies for build.gradle in subdirectories if there is gradlew in the same directory', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(true, standardUpdatesReport());
      await fsExtra.mkdirs(`${config.localDir}/foo`);
      await initializeWorkingDir(
        true,
        standardUpdatesReport(),
        `${config.localDir}/foo`
      );

      const dependencies = await manager.extractAllPackageFiles(config, [
        'foo/build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should configure the renovate report plugin', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);
      await initializeWorkingDir(true, standardUpdatesReport());

      jest.spyOn(os, 'platform').mockReturnValueOnce('linux');
      await manager.extractAllPackageFiles(config, ['build.gradle']);

      await expect(
        fsExtra.access(
          `${config.localDir}/renovate-plugin.gradle`,
          fsExtra.constants.F_OK
        )
      ).resolves.toBeUndefined();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker if required', async () => {
      const configWithDocker = { binarySource: BinarySource.Docker, ...config };
      jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
      await util.setUtilConfig(configWithDocker);
      await initializeWorkingDir(false, standardUpdatesReport());
      const execSnapshots = mockExecAll(exec, gradleOutput);

      await manager.extractAllPackageFiles(configWithDocker, ['build.gradle']);

      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker even if gradlew is available', async () => {
      const configWithDocker = { binarySource: BinarySource.Docker, ...config };
      jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
      await util.setUtilConfig(configWithDocker);
      await initializeWorkingDir(true, standardUpdatesReport());

      const execSnapshots = mockExecAll(exec, gradleOutput);
      await manager.extractAllPackageFiles(configWithDocker, ['build.gradle']);

      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker even if gradlew.bat is available on Windows', async () => {
      const configWithDocker = { binarySource: BinarySource.Docker, ...config };
      jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
      await util.setUtilConfig(configWithDocker);
      jest.spyOn(os, 'platform').mockReturnValueOnce('win32');
      await initializeWorkingDir(true, standardUpdatesReport());
      const execSnapshots = mockExecAll(exec, gradleOutput);

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

    it('should update an existing module dependency', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = await fsExtra.readFile(
        `${fixtures}/build.gradle.example1`,
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

    it('should update dependencies in same file', async () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = await fsExtra.readFile(
        `${fixtures}/build.gradle.example1`,
        'utf8'
      );

      const upgrade = {
        depGroup: 'org.apache.openjpa',
        name: 'openjpa',
        version: '3.1.1',
        newValue: '3.1.2',
      };

      const buildGradleContentUpdated = manager.updateDependency({
        fileContent: buildGradleContent,
        upgrade,
      });

      expect(buildGradleContent).not.toContain(
        'org.apache.openjpa:openjpa:3.1.2'
      );

      expect(buildGradleContentUpdated).not.toContain(
        "dependency 'org.apache.openjpa:openjpa:3.1.1'"
      );
      expect(buildGradleContentUpdated).not.toContain(
        "dependency 'org.apache.openjpa:openjpa:3.1.1'"
      );

      expect(buildGradleContentUpdated).toContain(
        "classpath 'org.apache.openjpa:openjpa:3.1.2'"
      );
      expect(buildGradleContentUpdated).toContain(
        "classpath 'org.apache.openjpa:openjpa:3.1.2'"
      );

      expect(execSnapshots).toMatchSnapshot();
    });
  });
});
