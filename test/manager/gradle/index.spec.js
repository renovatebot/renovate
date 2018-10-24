jest.mock('fs-extra');
jest.mock('child-process-promise');

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
    exec.mockReturnValue({ stdout: 'gradle output', stderr: '' });
  });

  describe('extractDependencies', () => {
    it('should return gradle dependencies', async () => {
      const dependencies = await manager.extractDependencies(
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
      const dependencies = await manager.extractDependencies(
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
      const dependencies = await manager.extractDependencies(
        'content',
        'build.gradle',
        config
      );

      expect(dependencies).toEqual(null);
    });

    it('should execute gradle with the proper parameters', async () => {
      await manager.extractDependencies('content', 'build.gradle', config);

      expect(exec.mock.calls[0][0]).toBe(
        'gradle --init-script init.gradle dependencyUpdates -Drevision=release'
      );
      expect(exec.mock.calls[0][1]).toMatchObject({
        cwd: 'localDir',
        timeout: 20000,
      });
    });

    it('should write the gradle config file in the tmp dir', async () => {
      await manager.preExtract(config, {
        'build.gradle': 'content root file',
        'subproject1/build.gradle': 'content subproject1',
        'subproject1/subproject2/build.gradle': 'content subproject2',
      });

      expect(fs.writeFile.mock.calls[0][0]).toBe('localDir/build.gradle');
      expect(fs.writeFile.mock.calls[0][1]).toBe('content root file');

      expect(fs.writeFile.mock.calls[1][0]).toBe(
        'localDir/subproject1/build.gradle'
      );
      expect(fs.writeFile.mock.calls[1][1]).toBe('content subproject1');

      expect(fs.writeFile.mock.calls[2][0]).toBe(
        'localDir/subproject1/subproject2/build.gradle'
      );
      expect(fs.writeFile.mock.calls[2][1]).toBe('content subproject2');
    });

    it('should configure the useLatestVersion plugin', async () => {
      await manager.extractDependencies('content', 'build.gradle', config);

      expect(fs.writeFile.mock.calls[0][0]).toBe('localDir/init.gradle');
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
