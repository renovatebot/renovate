const defaultConfig = require('../../lib/config/defaults').getConfig();
const manager = require('../../lib/manager');
const npm = require('../../lib/manager/npm');
const meteor = require('../../lib/manager/meteor');
const docker = require('../../lib/manager/docker');
const node = require('../../lib/manager/travis');
const bazel = require('../../lib/manager/bazel');

const path = require('path');
const fs = require('fs-extra');

const { getUpdatedPackageFiles } = manager;

describe('manager', () => {
  describe('detectPackageFiles(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...JSON.parse(JSON.stringify(defaultConfig)),
        warnings: [],
      };
    });
    it('skips if not in enabledManagers list', async () => {
      platform.getFileList.mockReturnValueOnce([
        'package.json',
        'backend/package.json',
      ]);
      config.enabledManagers = ['docker'];
      const res = await manager.detectPackageFiles(config);
      expect(res).toHaveLength(0);
    });
    it('skips if language is disabled', async () => {
      platform.getFileList.mockReturnValueOnce([
        'package.json',
        '.circleci/config.yml',
      ]);
      config.docker.enabled = false;
      const res = await manager.detectPackageFiles(config);
      expect(res).toHaveLength(1);
    });
    it('adds package files to object', async () => {
      platform.getFileList.mockReturnValueOnce([
        'package.json',
        'backend/package.json',
      ]);
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('finds meteor package files', async () => {
      config.meteor.enabled = true;
      platform.getFileList.mockReturnValueOnce([
        'modules/something/package.js',
      ]); // meteor
      platform.getFile.mockReturnValueOnce('Npm.depends( {} )');
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('skips meteor package files with no json', async () => {
      config.meteor.enabled = true;
      platform.getFileList.mockReturnValueOnce([
        'modules/something/package.js',
      ]); // meteor
      platform.getFile.mockReturnValueOnce('Npm.depends(packages)');
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(0);
    });
    it('finds Dockerfiles', async () => {
      platform.getFileList.mockReturnValueOnce([
        'Dockerfile',
        'other/Dockerfile',
        'another/Dockerfile',
      ]);
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
    });
    it('finds .travis.yml files', async () => {
      config.travis.enabled = true;
      platform.getFileList.mockReturnValueOnce([
        '.travis.yml',
        'other/.travis.yml',
      ]);
      platform.getFile.mockReturnValueOnce('sudo: true\nnode_js:\n  -8\n');
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('finds .nvmrc files', async () => {
      config.travis.enabled = true;
      platform.getFileList.mockReturnValueOnce(['.nvmrc', 'other/.nvmrc']);
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('finds WORKSPACE files', async () => {
      config.bazel.enabled = true;
      platform.getFileList.mockReturnValueOnce([
        'WORKSPACE',
        'other/WORKSPACE',
        'empty/WORKSPACE',
      ]);
      platform.getFile.mockReturnValueOnce('\n\ngit_repository(\n\n)\n');
      platform.getFile.mockReturnValueOnce(
        await fs.readFile(
          path.resolve('test/_fixtures/bazel/WORKSPACE1'),
          'utf8'
        )
      );
      platform.getFile.mockReturnValueOnce('foo');
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('ignores node modules', async () => {
      platform.getFileList.mockReturnValueOnce([
        'package.json',
        'node_modules/backend/package.json',
      ]);
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res.foundIgnoredPaths).toMatchSnapshot();
      expect(res.warnings).toMatchSnapshot();
    });
    it('uses includePaths', async () => {
      platform.getFileList.mockReturnValueOnce([
        'package.json',
        'backend/package.json',
      ]);
      config.includePaths = ['package.json'];
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
  });
  describe('getManager', () => {
    it('rejects unknown files', () => {
      expect(manager.getManager(defaultConfig, 'WORKSPACER')).toBe(null);
    });
    it('detects files in root', () => {
      expect(manager.getManager(defaultConfig, 'WORKSPACE')).toBe('bazel');
      expect(manager.getManager(defaultConfig, 'Dockerfile')).toBe('docker');
      expect(manager.getManager(defaultConfig, 'package.js')).toBe('meteor');
      expect(manager.getManager(defaultConfig, 'package.json')).toBe('npm');
      expect(manager.getManager(defaultConfig, '.nvmrc')).toBe('nvm');
      expect(manager.getManager(defaultConfig, '.travis.yml')).toBe('travis');
    });
    it('detects nested files', () => {
      expect(manager.getManager(defaultConfig, 'foo/bar/WORKSPACE')).toBe(
        'bazel'
      );
      expect(manager.getManager(defaultConfig, 'backend/Dockerfile')).toBe(
        'docker'
      );
      expect(manager.getManager(defaultConfig, 'package/a/package.js')).toBe(
        'meteor'
      );
      expect(manager.getManager(defaultConfig, 'frontend/package.json')).toBe(
        'npm'
      );
      expect(manager.getManager(defaultConfig, 'subfolder-1/.nvmrc')).toBe(
        null
      );
      expect(manager.getManager(defaultConfig, 'subfolder-2/.travis.yml')).toBe(
        null
      );
    });
  });
  describe('getUpdatedPackageFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        parentBranch: 'some-branch',
      };
      npm.updateDependency = jest.fn();
      docker.updateDependency = jest.fn();
      meteor.updateDependency = jest.fn();
      node.updateDependency = jest.fn();
      bazel.updateDependency = jest.fn();
    });
    it('returns empty if lock file maintenance', async () => {
      config.upgrades = [{ type: 'lockFileMaintenance' }];
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(0);
    });
    it('recurses if updateDependency error', async () => {
      config.parentBranch = 'some-branch';
      config.canRebase = true;
      config.upgrades = [{ packageFile: 'package.json', manager: 'npm' }];
      npm.updateDependency.mockReturnValueOnce(null);
      npm.updateDependency.mockReturnValueOnce('some content');
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(1);
    });
    it('errors if cannot rebase', async () => {
      config.upgrades = [{ packageFile: 'package.json', manager: 'npm' }];
      let e;
      try {
        await getUpdatedPackageFiles(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
    it('returns updated files', async () => {
      config.parentBranch = 'some-branch';
      config.canRebase = true;
      config.upgrades = [
        { packageFile: 'package.json', manager: 'npm' },
        { packageFile: 'Dockerfile', manager: 'docker' },
        { packageFile: 'packages/foo/package.js', manager: 'meteor' },
        { packageFile: '.travis.yml', manager: 'travis' },
        { packageFile: 'WORKSPACE', manager: 'bazel' },
      ];
      platform.getFile.mockReturnValueOnce('old content 1');
      platform.getFile.mockReturnValueOnce('old content 1');
      platform.getFile.mockReturnValueOnce('old content 2');
      platform.getFile.mockReturnValueOnce('old content 3');
      platform.getFile.mockReturnValueOnce('old travis');
      platform.getFile.mockReturnValueOnce('old WORKSPACE');
      npm.updateDependency.mockReturnValueOnce('new content 1');
      npm.updateDependency.mockReturnValueOnce('new content 1+');
      docker.updateDependency.mockReturnValueOnce('new content 2');
      meteor.updateDependency.mockReturnValueOnce('old content 3');
      node.updateDependency.mockReturnValueOnce('old travis');
      bazel.updateDependency.mockReturnValueOnce('old WORKSPACE');
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(2);
    });
  });
});
