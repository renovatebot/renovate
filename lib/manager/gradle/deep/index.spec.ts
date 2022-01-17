import type { Stats } from 'fs';
import os from 'os';
import { join } from 'upath';
import { extractAllPackageFiles, updateDependency } from '..';
import { envMock, exec, mockExecAll } from '../../../../test/exec-util';
import {
  addReplacingSerializer,
  env,
  fs,
  loadFixture,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import {
  ReleaseResult,
  getPkgReleases as _getPkgReleases,
} from '../../../datasource';
import * as docker from '../../../util/exec/docker';
import type { ExtractConfig } from '../../types';

jest.mock('child_process');
jest.mock('../../../util/exec/env');
jest.mock('../../../util/fs');
jest.mock('../../../datasource');

const getPkgReleases: jest.MockInstance<
  ReturnType<typeof _getPkgReleases>,
  jest.ArgsType<typeof _getPkgReleases>
> = _getPkgReleases as never;

const adminConfig: RepoGlobalConfig = {
  localDir: join('/foo/bar'),
};

const dockerAdminConfig = {
  ...adminConfig,
  binarySource: 'docker',
};

const gradleOutput = {
  stdout: 'gradle output',
  stderr: '',
};

const config: ExtractConfig = {
  deepExtract: true,
  gradle: {
    timeout: 60,
  },
};

const buildGradle = `
dependency 'foo:foo:1.2.3'
dependency "bar:bar:This.Is.Valid.Version.Good.Luck"
dependency "baz:baz:\${bazVersion}"
`;

const graddleWrapperPropertiesData = loadFixture(
  '/gradle-wrappers/6/gradle/wrapper/gradle-wrapper.properties'
);

addReplacingSerializer('gradlew.bat', '<gradlew>');
addReplacingSerializer('./gradlew', '<gradlew>');

const javaReleases: ReleaseResult = {
  releases: [
    { version: '8.0.302' },
    { version: '11.0.12' },
    { version: '16.0.2' },
  ],
};

describe('manager/gradle/deep/index', () => {
  const updatesReport = loadFixture('updatesReport.json');

  function setupMocks({
    wrapperFilename = `gradlew`,
    wrapperPropertiesFilename = 'gradle/wrapper/gradle-wrapper.properties',
    pluginFilename = 'renovate-plugin.gradle',
    report = updatesReport,
    reportFilename = 'gradle-renovate-report.json',
    packageFilename = 'build.gradle',
    output = gradleOutput,
  } = {}) {
    fs.stat.mockImplementationOnce((_dirname) => {
      if (wrapperFilename) {
        return Promise.resolve({
          isFile: () => true,
        } as Stats);
      }
      return Promise.reject();
    });
    fs.writeLocalFile.mockImplementation((f, _content) => {
      if (f?.endsWith(pluginFilename)) {
        return Promise.resolve();
      }
      return Promise.reject();
    });
    fs.localPathExists.mockImplementation((f) => {
      if (f?.endsWith(reportFilename)) {
        return Promise.resolve(!!report);
      }
      if (f?.endsWith(wrapperPropertiesFilename)) {
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    });
    fs.readLocalFile.mockImplementation((f) => {
      if (f?.endsWith(reportFilename)) {
        return report ? Promise.resolve(report) : Promise.reject();
      }
      if (f?.endsWith(packageFilename)) {
        return Promise.resolve(buildGradle);
      }
      if (f?.endsWith(wrapperPropertiesFilename)) {
        return Promise.resolve(graddleWrapperPropertiesData);
      }
      return Promise.resolve('');
    });

    return mockExecAll(exec, output);
  }

  beforeAll(() => {
    GlobalConfig.set(adminConfig);
  });

  afterAll(() => {
    GlobalConfig.reset();
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
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.deps).toHaveLength(8);
      expect(dependencies).toMatchSnapshot([
        {
          datasource: 'maven',
          packageFile: 'build.gradle',
        },
      ]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return gradle.kts dependencies', async () => {
      const execSnapshots = setupMocks({ packageFilename: 'build.gradle.kts' });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle.kts',
      ]);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.deps).toHaveLength(8);
      expect(dependencies).toMatchSnapshot([
        {
          datasource: 'maven',
          packageFile: 'build.gradle.kts',
        },
      ]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if there are no dependencies', async () => {
      const execSnapshots = setupMocks({
        report: loadFixture('updatesReportEmpty.json'),
      });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toBeEmptyArray();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if there is no dependency report', async () => {
      const execSnapshots = setupMocks({ report: null });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toBeEmptyArray();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return empty if renovate report is invalid', async () => {
      const execSnapshots = setupMocks({ report: '!@#$%' });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toBeEmptyArray();
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use repositories only for current project', async () => {
      const execSnapshots = setupMocks({
        report: loadFixture(`MultiProjectUpdatesReport.json`),
      });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.deps).toHaveLength(3);
      expect(dependencies).toMatchSnapshot([
        {
          datasource: 'maven',
          packageFile: 'build.gradle',
        },
      ]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradlew when available', async () => {
      const execSnapshots = setupMocks();
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.deps).toHaveLength(8);
      expect(dependencies).toMatchSnapshot([
        {
          datasource: 'maven',
          packageFile: 'build.gradle',
        },
      ]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradlew.bat when available on Windows', async () => {
      const execSnapshots = setupMocks({ wrapperFilename: 'gradlew.bat' });
      jest.spyOn(os, 'platform').mockReturnValueOnce('win32');
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.deps).toHaveLength(8);
      expect(dependencies).toMatchSnapshot([
        {
          datasource: 'maven',
          packageFile: 'build.gradle',
        },
      ]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should execute gradle if gradlew is not available', async () => {
      const execSnapshots = setupMocks({
        wrapperFilename: null,
        wrapperPropertiesFilename: null,
      });
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.deps).toHaveLength(8);
      expect(dependencies).toMatchSnapshot([
        {
          datasource: 'maven',
          packageFile: 'build.gradle',
        },
      ]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should return null and gradle should not be executed if no root build.gradle', async () => {
      const execSnapshots = setupMocks({
        wrapperFilename: null,
        report: null,
        wrapperPropertiesFilename: null,
      });
      const packageFiles = ['foo/build.gradle'];
      expect(await extractAllPackageFiles(config, packageFiles)).toBeNull();
      expect(execSnapshots).toBeEmpty();
    });

    it('should return gradle dependencies for build.gradle in subdirectories if there is gradlew in the same directory', async () => {
      const execSnapshots = setupMocks({
        wrapperFilename: 'baz/qux/gradlew',
        wrapperPropertiesFilename:
          'baz/qux/gradle/wrapper/gradle-wrapper.properties',
        packageFilename: 'baz/qux/build.gradle',
        reportFilename: 'baz/qux/gradle-renovate-report.json',
        pluginFilename: 'baz/qux/renovate-plugin.gradle',
      });

      const dependencies = await extractAllPackageFiles(config, [
        'baz/qux/build.gradle',
      ]);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.deps).toHaveLength(8);
      expect(dependencies).toMatchSnapshot([
        {
          datasource: 'maven',
          packageFile: 'baz/qux/build.gradle',
        },
      ]);
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker if required', async () => {
      GlobalConfig.set(dockerAdminConfig);
      const execSnapshots = setupMocks({
        wrapperFilename: null,
        wrapperPropertiesFilename: null,
      });
      getPkgReleases.mockResolvedValueOnce(javaReleases);
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.deps).toHaveLength(8);
      expect(dependencies).toMatchSnapshot([
        {
          datasource: 'maven',
          packageFile: 'build.gradle',
        },
      ]);
      expect(execSnapshots[0].cmd).toBe('docker pull renovate/java:11.0.12');
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker even if gradlew is available', async () => {
      GlobalConfig.set(dockerAdminConfig);
      const execSnapshots = setupMocks();
      getPkgReleases.mockResolvedValueOnce(javaReleases);
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.deps).toHaveLength(8);
      expect(dependencies).toMatchSnapshot([
        {
          datasource: 'maven',
          packageFile: 'build.gradle',
        },
      ]);
      expect(execSnapshots[0].cmd).toBe('docker pull renovate/java:11.0.12');
      expect(execSnapshots).toMatchSnapshot();
    });

    it('should use docker even if gradlew.bat is available on Windows', async () => {
      GlobalConfig.set(dockerAdminConfig);
      jest.spyOn(os, 'platform').mockReturnValueOnce('win32');
      const execSnapshots = setupMocks({ wrapperFilename: 'gradlew.bat' });
      getPkgReleases.mockResolvedValueOnce(javaReleases);
      const dependencies = await extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.deps).toHaveLength(8);
      expect(dependencies).toMatchSnapshot([
        {
          datasource: 'maven',
          packageFile: 'build.gradle',
        },
      ]);
      expect(execSnapshots[0].cmd).toBe('docker pull renovate/java:11.0.12');
      expect(execSnapshots).toMatchSnapshot();
    });
  });

  describe('updateDependency', () => {
    it('should update an existing module dependency', () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = loadFixture(`build.gradle.example1`);
      // prettier-ignore
      const upgrade = {
        deepExtract: true,
        depGroup: 'cglib', name: 'cglib-nodep', version: '3.1', newValue: '3.2.8',
      };
      const buildGradleContentUpdated = updateDependency({
        fileContent: buildGradleContent,
        upgrade,
      });

      expect(buildGradleContent).not.toMatch('cglib:cglib-nodep:3.2.8');

      expect(buildGradleContentUpdated).toMatch('cglib:cglib-nodep:3.2.8');
      expect(buildGradleContentUpdated).not.toMatch('cglib:cglib-nodep:3.1');

      expect(execSnapshots).toBeEmpty();
    });

    it('should update an existing plugin dependency', () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = `
        plugins {
            id "com.github.ben-manes.versions" version "0.20.0"
        }
        `;
      const upgrade = {
        deepExtract: true,
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

      expect(execSnapshots).toBeEmpty();
    });

    it('should update an existing plugin dependency with Kotlin DSL', () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = `
        plugins {
            id("com.github.ben-manes.versions") version "0.20.0"
        }
        `;
      const upgrade = {
        deepExtract: true,
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

      expect(execSnapshots).toBeEmpty();
    });

    it('should update dependencies in same file', () => {
      const execSnapshots = mockExecAll(exec, gradleOutput);

      const buildGradleContent = loadFixture(`build.gradle.example1`);

      const upgrade = {
        deepExtract: true,
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

      expect(execSnapshots).toBeEmpty();
    });

    it('should return null for replacement', () => {
      const res = updateDependency({
        fileContent: undefined,
        upgrade: { deepExtract: true, updateType: 'replacement' },
      });
      expect(res).toBeNull();
    });
  });
});
