import { exec as _exec } from 'child_process';
import type { Stats } from 'fs';
import os from 'os';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import {
  addReplacingSerializer,
  getName,
  loadFixture,
  mocked,
} from '../../../test/util';
import { setUtilConfig } from '../../util';
import { setExecConfig } from '../../util/exec';
import { BinarySource } from '../../util/exec/common';
import * as docker from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import { extractAllPackageFiles, updateDependency } from '.';

jest.mock('child_process');
const exec: jest.Mock<typeof _exec> = _exec as never;

jest.mock('fs-extra');
const fs = mocked(_fs);

jest.mock('../../util/exec/env');
const env = mocked(_env);

const gradleOutput = {
  stdout: 'gradle output',
  stderr: '',
};

const utilConfig = {
  localDir: join('/foo/bar'),
};

const config = {
  ...utilConfig,
  gradle: {
    timeout: 60,
  },
};

const buildGradle = `
dependency 'foo:foo:1.2.3'
dependency "bar:bar:This.Is.Valid.Version.Good.Luck"
dependency "baz:baz:\${bazVersion}"
`;

addReplacingSerializer('gradlew.bat', '<gradlew>');
addReplacingSerializer('./gradlew', '<gradlew>');

describe(getName(), () => {
  const updatesReport = loadFixture('updatesReport.json');

  function setupMocks({
    baseDir = '/foo/bar',
    wrapperFilename = `gradlew`,
    pluginFilename = 'renovate-plugin.gradle',
    report = updatesReport,
    reportFilename = 'gradle-renovate-report.json',
    packageFilename = 'build.gradle',
    output = gradleOutput,
  } = {}) {
    fs.stat.mockImplementationOnce((dirname) => {
      if (wrapperFilename) {
        return Promise.resolve({
          isFile: () => true,
        } as Stats);
      }
      return Promise.reject();
    });
    fs.writeFile.mockImplementationOnce((_filename, _content) => {});
    fs.exists.mockImplementationOnce((_filename) => Promise.resolve(!!report));
    fs.readFile.mockImplementationOnce((filename) =>
      report ? Promise.resolve(report as never) : Promise.reject()
    );
    fs.readFile.mockImplementationOnce((filename) =>
      Promise.resolve(buildGradle as never)
    );
    return mockExecAll(exec, output);
  }

  beforeAll(async () => {
    await setUtilConfig(utilConfig);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    docker.resetPrefetchedImages();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });

  describe('extractPackageFile', () => {
    it('should update an existing module dependency', async () => {
      const execSnapshots = setupMocks();
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return gradle.kts dependencies', async () => {
      const execSnapshots = setupMocks();
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle.kts',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if there are no dependencies', async () => {
      const execSnapshots = setupMocks({
        report: loadFixture('updatesReportEmpty.json'),
      });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toEqual([]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if there is no dependency report', async () => {
      const execSnapshots = setupMocks({ report: null });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toEqual([]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if renovate report is invalid', async () => {
      const execSnapshots = setupMocks({ report: '!@#$%' });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toEqual([]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use repositories only for current project', async () => {
      const execSnapshots = setupMocks({
        report: loadFixture(`MultiProjectUpdatesReport.json`),
      });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradlew when available', async () => {
      const execSnapshots = setupMocks();
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradlew.bat when available on Windows', async () => {
      const execSnapshots = setupMocks({ wrapperFilename: 'gradlew.bat' });
      jest.spyOn(os, 'platform').mockReturnValueOnce('win32');
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradle if gradlew is not available', async () => {
      const execSnapshots = setupMocks({ wrapperFilename: null });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return null and gradle should not be executed if no root build.gradle', async () => {
      const execSnapshots = setupMocks({ wrapperFilename: null, report: null });
      const packageFiles = ['foo/build.gradle'];
      expect(await extractAllPackageFiles(config, packageFiles)).toBeNull();
      expect(execSnapshots).toBeEmpty();
    });

    it('should return gradle dependencies for build.gradle in subdirectories if there is gradlew in the same directory', async () => {
      const execSnapshots = setupMocks({
        baseDir: '/foo/bar/',
        wrapperFilename: 'baz/qux/gradlew',
        packageFilename: 'baz/qux/build.gradle',
        reportFilename: 'baz/qux/gradle-renovate-report.json',
        pluginFilename: 'baz/qux/renovate-plugin.gradle',
      });

      const dependencies = await extractAllPackageFiles(config, [
        'baz/qux/build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker if required', async () => {
      const dockerConfig = { ...config, binarySource: BinarySource.Docker };
      jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
      await setExecConfig(dockerConfig);
      const execSnapshots = setupMocks({ wrapperFilename: null });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker even if gradlew is available', async () => {
      const dockerConfig = { ...config, binarySource: BinarySource.Docker };
      jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
      await setExecConfig(dockerConfig);
      const execSnapshots = setupMocks();
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker even if gradlew.bat is available on Windows', async () => {
      const dockerConfig = { ...config, binarySource: BinarySource.Docker };
      jest.spyOn(docker, 'removeDanglingContainers').mockResolvedValueOnce();
      await setExecConfig(dockerConfig);
      jest.spyOn(os, 'platform').mockReturnValueOnce('win32');
      const execSnapshots = setupMocks({ wrapperFilename: 'gradlew.bat' });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });
  });

  describe('updateDependency', () => {
    it('should update an existing module dependency', () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = loadFixture(`build.gradle.example1`);
      // prettier-ignore
      const upgrade = {
        depGroup: 'cglib', name: 'cglib-nodep', version: '3.1', newValue: '3.2.8',
      };
      const buildGradleContentUpdated = updateDependency({
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
      const buildGradleContentUpdated = updateDependency({
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
      const buildGradleContentUpdated = updateDependency({
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

    it('should update dependencies in same file', () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = loadFixture(`build.gradle.example1`);

      const upgrade = {
        depGroup: 'org.apache.openjpa',
        name: 'openjpa',
        version: '3.1.1',
        newValue: '3.1.2',
      };

      const buildGradleContentUpdated = updateDependency({
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
