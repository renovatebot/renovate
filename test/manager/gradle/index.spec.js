jest.mock('fs-extra');
jest.mock('child-process-promise');

const { toUnix } = require('upath');
const fs = require('fs-extra');
const fsReal = require('fs');
const { exec } = require('child-process-promise');
const { initLogger } = require('../../../lib/logger');

initLogger();

const manager = require('../../../lib/manager/gradle/index');

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

describe('manager/gradle', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fs.readFile.mockReturnValue(updatesDependenciesReport);
    fs.mkdir.mockReturnValue(true);
    fs.exists.mockReturnValue(true);
    exec.mockReturnValue({ stdout: 'gradle output', stderr: '' });
    platform.getFile.mockReturnValue('some content');
  });

  describe('extractPackageFile', () => {
    it('should return gradle dependencies', async () => {
      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
        'subproject/build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
    });

    it('should return empty if there are no dependencies', async () => {
      fs.readFile.mockReturnValue(
        fsReal.readFileSync(
          'test/datasource/gradle/_fixtures/updatesReportEmpty.json',
          'utf8'
        )
      );
      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);

      expect(dependencies).toEqual([]);
    });

    it('should throw registry failure if gradle execution fails', async () => {
      exec.mockImplementation(() => {
        throw new Error();
      });
      let e;
      try {
        await manager.extractAllPackageFiles(config, ['build.gradle']);
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
    });

    it('should return empty if there is no dependency report', async () => {
      fs.exists.mockReturnValue(false);
      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);

      expect(dependencies).toEqual([]);
    });

    it('should return empty if renovate report is invalid', async () => {
      const renovateReport = `
        Invalid JSON]
      `;
      fs.readFile.mockReturnValue(renovateReport);

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toEqual([]);
    });

    it('should use repositories only for current project', async () => {
      const multiProjectUpdatesReport = fsReal.readFileSync(
        'test/datasource/gradle/_fixtures/MultiProjectUpdatesReport.json',
        'utf8'
      );
      fs.readFile.mockReturnValue(multiProjectUpdatesReport);

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
    });

    it('should execute gradle with the proper parameters', async () => {
      await manager.extractAllPackageFiles(config, ['build.gradle']);

      expect(exec.mock.calls[0][0]).toBe(
        'gradle --init-script renovate-plugin.gradle renovate'
      );
      expect(exec.mock.calls[0][1]).toMatchObject({
        cwd: 'localDir',
        timeout: 20000,
      });
    });

    it('should execute gradlew when available', async () => {
      const configWithgitFs = {
        gitFs: true,
        ...config,
      };

      await manager.extractAllPackageFiles(configWithgitFs, ['build.gradle']);

      expect(exec.mock.calls[0][0]).toBe(
        'sh gradlew --init-script renovate-plugin.gradle renovate'
      );
      expect(exec.mock.calls[0][1]).toMatchObject({
        cwd: 'localDir',
        timeout: 20000,
      });
    });

    it('should return null and gradle should not be executed if no build.gradle', async () => {
      const packageFiles = ['foo/build.gradle'];
      expect(
        await manager.extractAllPackageFiles(config, packageFiles)
      ).toBeNull();

      expect(exec).toHaveBeenCalledTimes(0);
    });

    it('should write files before extracting', async () => {
      const packageFiles = ['build.gradle', 'foo/build.gradle'];
      await manager.extractAllPackageFiles(config, packageFiles);

      expect(toUnix(fs.outputFile.mock.calls[0][0])).toBe(
        'localDir/build.gradle'
      );
      expect(toUnix(fs.outputFile.mock.calls[1][0])).toBe(
        'localDir/foo/build.gradle'
      );
    });

    it('should not write files if gitFs is enabled', async () => {
      const configWithgitFs = {
        gitFs: true,
        ...config,
      };

      const packageFiles = ['build.gradle', 'foo/build.gradle'];
      await manager.extractAllPackageFiles(configWithgitFs, packageFiles);

      expect(fs.outputFile).toHaveBeenCalledTimes(0);
    });

    it('should configure the renovate report plugin', async () => {
      await manager.extractAllPackageFiles(config, ['build.gradle']);

      expect(toUnix(fs.writeFile.mock.calls[0][0])).toBe(
        'localDir/renovate-plugin.gradle'
      );
    });

    it('should use docker if required', async () => {
      const configWithDocker = {
        binarySource: 'docker',
        ...config,
      };
      await manager.extractAllPackageFiles(configWithDocker, ['build.gradle']);

      expect(exec.mock.calls[0][0]).toBe(
        'docker run --rm -v localDir:localDir -w localDir renovate/gradle gradle --init-script renovate-plugin.gradle renovate'
      );
    });

    it('should use dcoker even if gradlew is available', async () => {
      const configWithDocker = {
        binarySource: 'docker',
        gitFs: true,
        ...config,
      };
      await manager.extractAllPackageFiles(configWithDocker, ['build.gradle']);

      expect(exec.mock.calls[0][0]).toBe(
        'docker run --rm -v localDir:localDir -w localDir renovate/gradle gradle --init-script renovate-plugin.gradle renovate'
      );
    });
  });

  describe('updateDependency', () => {
    it('should update an existing dependency', () => {
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
    });
  });
});
