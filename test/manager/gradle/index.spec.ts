import { toUnix } from 'upath';
import _fs from 'fs-extra';
import fsReal from 'fs';
import { exec as _exec } from '../../../lib/util/exec';
import * as manager from '../../../lib/manager/gradle';

jest.mock('fs-extra');
jest.mock('../../../lib/util/exec');

const _platform: jest.Mocked<typeof global.platform> = global.platform as any;
const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;

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
    fs.readFile.mockResolvedValue(updatesDependenciesReport as any);
    fs.mkdir.mockResolvedValue();
    fs.exists.mockResolvedValue(true);
    exec.mockResolvedValue({ stdout: 'gradle output', stderr: '' } as never);
    _platform.getFile.mockResolvedValue('some content');
  });

  describe('extractPackageFile', () => {
    it('should return gradle dependencies', async () => {
      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
        'subproject/build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
    });

    it('should return gradle.kts dependencies', async () => {
      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle.kts',
        'subproject/build.gradle.kts',
      ]);
      expect(dependencies).toMatchSnapshot();
    });

    it('should return empty if there are no dependencies', async () => {
      fs.readFile.mockResolvedValue(fsReal.readFileSync(
        'test/datasource/gradle/_fixtures/updatesReportEmpty.json',
        'utf8'
      ) as any);
      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);

      expect(dependencies).toEqual([]);
    });

    it('should throw registry failure if gradle execution fails', async () => {
      exec.mockImplementation(() => {
        throw new Error();
      });
      await expect(
        manager.extractAllPackageFiles(config, ['build.gradle'])
      ).rejects.toMatchSnapshot();
    });

    it('should return empty if there is no dependency report', async () => {
      fs.exists.mockResolvedValue(false);
      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);

      expect(dependencies).toEqual([]);
    });

    it('should return empty if renovate report is invalid', async () => {
      const renovateReport = `
        Invalid JSON]
      `;
      fs.readFile.mockResolvedValue(renovateReport as any);

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
      fs.readFile.mockResolvedValue(multiProjectUpdatesReport as any);

      const dependencies = await manager.extractAllPackageFiles(config, [
        'build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
    });

    it('should execute gradlew when available', async () => {
      await manager.extractAllPackageFiles(config, ['build.gradle']);

      expect(exec.mock.calls[0][0]).toBe(
        'sh gradlew --init-script renovate-plugin.gradle renovate'
      );
      expect(exec.mock.calls[0][1]).toMatchObject({
        cwd: 'localDir',
        timeout: 20000,
      });
    });

    it('should return null and gradle should not be executed if no root build.gradle', async () => {
      fs.exists.mockResolvedValue(false);

      const packageFiles = ['foo/build.gradle'];
      expect(
        await manager.extractAllPackageFiles(config, packageFiles)
      ).toBeNull();

      expect(exec).toHaveBeenCalledTimes(0);
    });

    it('should return gradle dependencies for build.gradle in subdirectories if there is gradlew in the same directory', async () => {
      const dependencies = await manager.extractAllPackageFiles(config, [
        'foo/build.gradle',
      ]);
      expect(dependencies).toMatchSnapshot();
    });

    it('should configure the renovate report plugin', async () => {
      await manager.extractAllPackageFiles(config, ['build.gradle']);

      expect(toUnix(fs.writeFile.mock.calls[0][0] as string)).toBe(
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
        ...config,
        gradle: {},
      };
      await manager.extractAllPackageFiles(configWithDocker, ['build.gradle']);

      expect(exec.mock.calls[0][0]).toBe(
        'docker run --rm -v localDir:localDir -w localDir renovate/gradle gradle --init-script renovate-plugin.gradle renovate'
      );
    });
  });

  describe('updateDependency', () => {
    it('should update an existing module dependency', () => {
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

    it('should update an existing plugin dependency', () => {
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
    });

    it('should update an existing plugin dependency with Kotlin DSL', () => {
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
    });
  });
});
