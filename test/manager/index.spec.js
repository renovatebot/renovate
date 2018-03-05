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
        ...defaultConfig,
        warnings: [],
      };
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
      platform.getFile.mockReturnValueOnce(
        '### comment\n\n \nFROM something\nRUN something\nFROM something-else\nRUN bar'
      );
      platform.getFile.mockReturnValueOnce(
        'ARG foo\nFROM something\nRUN something'
      );
      platform.getFile.mockReturnValueOnce(
        'ARG foo\nno FROM at all\nRUN something'
      );
      const res = await manager.detectPackageFiles(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
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
    it('skips Dockerfiles with no content', async () => {
      platform.getFileList.mockReturnValueOnce(['Dockerfile']);
      platform.getFile.mockReturnValueOnce(null);
      const res = await manager.detectPackageFiles(config);
      expect(res).toHaveLength(0);
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
  });
  describe('getManager', () => {
    it('rejects unknown files', () => {
      expect(manager.getManager('WORKSPACER')).toBe(null);
    });
    it('detects files in root', () => {
      expect(manager.getManager('WORKSPACE')).toBe('bazel');
      expect(manager.getManager('Dockerfile')).toBe('docker');
      expect(manager.getManager('package.js')).toBe('meteor');
      expect(manager.getManager('package.json')).toBe('npm');
      expect(manager.getManager('.nvmrc')).toBe('nvm');
      expect(manager.getManager('.travis.yml')).toBe('travis');
    });
    it('detects nested files', () => {
      expect(manager.getManager('foo/bar/WORKSPACE')).toBe('bazel');
      expect(manager.getManager('backend/Dockerfile')).toBe('docker');
      expect(manager.getManager('package/a/package.js')).toBe('meteor');
      expect(manager.getManager('frontend/package.json')).toBe('npm');
      expect(manager.getManager('subfolder-1/.nvmrc')).toBe(null);
      expect(manager.getManager('subfolder-2/.travis.yml')).toBe(null);
    });
  });
  describe('getUpdatedPackageFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        parentBranch: 'some-branch',
      };
      npm.setNewValue = jest.fn();
      docker.setNewValue = jest.fn();
      meteor.setNewValue = jest.fn();
      node.setNewValue = jest.fn();
      bazel.setNewValue = jest.fn();
    });
    it('returns empty if lock file maintenance', async () => {
      config.upgrades = [{ type: 'lockFileMaintenance' }];
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(0);
    });
    it('recurses if setNewValue error', async () => {
      config.parentBranch = 'some-branch';
      config.canRebase = true;
      config.upgrades = [{ packageFile: 'package.json', manager: 'npm' }];
      npm.setNewValue.mockReturnValueOnce(null);
      npm.setNewValue.mockReturnValueOnce('some content');
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
      npm.setNewValue.mockReturnValueOnce('new content 1');
      npm.setNewValue.mockReturnValueOnce('new content 1+');
      docker.setNewValue.mockReturnValueOnce('new content 2');
      meteor.setNewValue.mockReturnValueOnce('old content 3');
      node.setNewValue.mockReturnValueOnce('old travis');
      bazel.setNewValue.mockReturnValueOnce('old WORKSPACE');
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(2);
    });
  });
});
