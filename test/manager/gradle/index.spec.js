jest.mock('fs-extra');
jest.mock('child-process-promise');

const { toUnix } = require('upath');
const fs = require('fs-extra');
const fsReal = require('fs');
const { exec } = require('child-process-promise');

const manager = require('../../../lib/manager/gradle/index');

const config = {
  localDir: 'localDir',
  gradle: {
    timeout: 20,
  },
};

const updatesDependenciesReport = fsReal.readFileSync(
  'test/_fixtures/gradle/updatesReport.json',
  'utf8'
);

describe('manager/gradle', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fs.readFile.mockReturnValue(updatesDependenciesReport);
    fs.mkdir.mockReturnValue(true);
    fs.exists.mockReturnValue(true);
    exec.mockReturnValue({ stdout: 'gradle output', stderr: '' });
  });

  describe('extractPackageFile', () => {
    it('should return gradle dependencies', async () => {
      const dependencies = await manager.extractPackageFile(
        'content',
        'build.gradle',
        config
      );

      expect(dependencies).toMatchSnapshot();
    });

    it('should return null if there are no dependencies', async () => {
      fs.readFile.mockReturnValue(
        fsReal.readFileSync(
          'test/_fixtures/gradle/updatesReportEmpty.json',
          'utf8'
        )
      );
      const dependencies = await manager.extractPackageFile(
        'content',
        'build.gradle',
        config
      );

      expect(dependencies).toEqual(null);
    });

    it('should return null if gradle execution fails', async () => {
      exec.mockImplementation(() => {
        throw new Error();
      });

      const dependencies = await manager.extractPackageFile(
        'content',
        'build.gradle',
        config
      );

      expect(dependencies).toEqual(null);
    });

    it('should return empty if there is no dependency report', async () => {
      fs.readFile.mockImplementation(() => {
        throw new Error();
      });
      fs.exists.mockReturnValue(false);

      const dependencies = await manager.extractPackageFile(
        'content',
        'build.gradle',
        config
      );

      expect(dependencies).toEqual(null);
    });

    it('should execute gradle with the proper parameters', async () => {
      await manager.extractPackageFile('content', 'build.gradle', config);

      expect(exec.mock.calls[0][0]).toBe(
        'gradle --init-script init.gradle dependencyUpdates -Drevision=release'
      );
      expect(exec.mock.calls[0][1]).toMatchObject({
        cwd: 'localDir',
        timeout: 20000,
      });
    });

    it('should return null if no build.gradle', async () => {
      const packageFiles = ['foo/build.gradle'];
      expect(
        await manager.extractAllPackageFiles(config, packageFiles)
      ).toBeNull();
    });

    it('should return empty if not content', async () => {
      const packageFiles = ['build.gradle'];
      const res = await manager.extractAllPackageFiles(config, packageFiles);
      expect(res).toEqual([]);
    });

    it('should write files before extracting', async () => {
      const packageFiles = ['build.gradle'];
      platform.getFile.mockReturnValue('some content');
      const res = await manager.extractAllPackageFiles(config, packageFiles);
      expect(res).not.toBeNull();
    });

    it('should configure the useLatestVersion plugin', async () => {
      await manager.extractPackageFile('content', 'build.gradle', config);

      expect(toUnix(fs.writeFile.mock.calls[0][0])).toBe(
        'localDir/init.gradle'
      );
    });

    it('should use docker if required', async () => {
      const configWithDocker = {
        binarySource: 'docker',
        ...config,
      };
      await manager.extractPackageFile(
        'content',
        'build.gradle',
        configWithDocker
      );

      expect(exec.mock.calls[0][0]).toBe(
        'docker run --rm -v localDir:localDir -w localDir renovate/gradle gradle --init-script init.gradle dependencyUpdates -Drevision=release'
      );
    });
  });

  describe('getPackageUpdates', () => {
    it('should return the new version if it is available', async () => {
      const newVersion = {
        ...config,
        depName: 'cglib:cglib-nodep',
        available: {
          release: '3.2.8',
        },
      };
      const outdatedDependencies = await manager.getPackageUpdates(newVersion);

      expect(outdatedDependencies).toMatchObject([
        {
          depName: 'cglib:cglib-nodep',
          newValue: '3.2.8',
        },
      ]);
    });

    it('should return empty if there is no new version', async () => {
      const newVersion = {
        ...config,
        depName: 'cglib:cglib-nodep',
      };
      const outdatedDependencies = await manager.getPackageUpdates(newVersion);

      expect(outdatedDependencies).toMatchObject([]);
    });
  });

  describe('updateDependency', () => {
    it('should update an existing dependency', () => {
      const buildGradleContent = fsReal.readFileSync(
        'test/_fixtures/gradle/build.gradle.example1',
        'utf8'
      );
      // prettier-ignore
      const upgrade = {
        depGroup: 'cglib', name: 'cglib-nodep', version: '3.1',
        available: { release: '3.2.8', milestone: null, integration: null },
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
