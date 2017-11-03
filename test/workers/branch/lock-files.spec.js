const fs = require('fs-extra');
const lockFiles = require('../../../lib/workers/branch/lock-files');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const logger = require('../../_fixtures/logger');
const npm = require('../../../lib/workers/branch/npm');
const yarn = require('../../../lib/workers/branch/yarn');

const {
  hasPackageLock,
  hasYarnLock,
  determineLockFileDirs,
  writeExistingFiles,
  writeUpdatedPackageFiles,
  getUpdatedLockFiles,
} = lockFiles;

describe('workers/branch/lock-files', () => {
  describe('hasPackageLock', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        logger,
      };
    });
    it('returns true if found and true', () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          packageLock: 'some package lock',
        },
      ];
      expect(hasPackageLock(config, 'package.json')).toBe(true);
    });
    it('returns false if found and false', () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          packageLock: 'some package lock',
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      expect(hasPackageLock(config, 'backend/package.json')).toBe(false);
    });
    it('throws error if not found', () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          packageLock: 'some package lock',
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      let e;
      try {
        hasPackageLock(config, 'frontend/package.json');
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
  });
  describe('hasYarnLock', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        logger,
      };
    });
    it('returns true if found and true', () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          yarnLock: '# some yarn lock',
        },
      ];
      expect(hasYarnLock(config, 'package.json')).toBe(true);
    });
    it('returns false if found and false', () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          yarnLock: '# some yarn lock',
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      expect(hasYarnLock(config, 'backend/package.json')).toBe(false);
    });
    it('throws error if not found', () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          yarnLock: '# some yarn lock',
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      let e;
      try {
        hasYarnLock(config, 'frontend/package.json');
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
  });
  describe('determineLockFileDirs', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        logger,
        packageFiles: [
          {
            packageFile: 'package.json',
            yarnLock: '# some yarn lock',
          },
          {
            packageFile: 'backend/package.json',
            packageLock: 'some package lock',
          },
        ],
      };
    });
    it('returns all directories if lock file maintenance', () => {
      config.upgrades = [{ type: 'lockFileMaintenance' }];
      const res = determineLockFileDirs(config);
      expect(res).toMatchSnapshot();
    });
    it('returns directories from updated package files', () => {
      config.upgrades = [{}];
      config.updatedPackageFiles = [
        {
          name: 'package.json',
          contents: 'some contents',
        },
        {
          name: 'backend/package.json',
          contents: 'some contents',
        },
      ];
      const res = determineLockFileDirs(config);
      expect(res).toMatchSnapshot();
    });
    it('returns root directory if using yarn workspaces', () => {
      config.workspaceDir = '.';
      config.upgrades = [{}];
      config.packageFiles = [
        {
          packageFile: 'package.json',
          yarnLock: '# some yarn lock',
        },
        {
          packageFile: 'backend/package.json',
          workspaceDir: '.',
        },
      ];
      config.updatedPackageFiles = [
        {
          name: 'backend/package.json',
          contents: 'some contents',
        },
      ];
      const res = determineLockFileDirs(config);
      expect(res).toMatchSnapshot();
      expect(res.packageLockFileDirs).toHaveLength(0);
      expect(res.yarnLockFileDirs).toHaveLength(1);
      expect(res.yarnLockFileDirs[0]).toEqual('.');
    });
  });
  describe('writeExistingFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        logger,
        tmpDir: { path: 'some-tmp-dir' },
      };
      fs.outputFile = jest.fn();
      fs.remove = jest.fn();
    });
    it('returns if no packageFiles', async () => {
      config.npmrc = 'some-npmrc';
      config.yarnrc = 'some-yarnrc';
      delete config.packageFiles;
      await writeExistingFiles(config);
      expect(fs.outputFile.mock.calls).toHaveLength(2);
    });
    it('writes files and removes files', async () => {
      config.npmrc = 'some-npmrc';
      config.packageFiles = [
        {
          packageFile: 'package.json',
          content: { name: 'package 1' },
          npmrc: 'some npmrc',
        },
        {
          packageFile: 'backend/package.json',
          hasPackageLock: true,
          content: { name: 'package-2', engines: { yarn: '^0.27.5' } },
          yarnrc: 'some yarnrc',
        },
      ];
      await writeExistingFiles(config);
      expect(fs.outputFile.mock.calls).toMatchSnapshot();
      expect(fs.outputFile.mock.calls).toHaveLength(6);
      expect(fs.remove.mock.calls).toHaveLength(4);
    });
    it('writes lock files', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          content: { name: 'package 1' },
          yarnLock: 'some yarn lock',
          packageLock: 'some package lock',
        },
      ];
      await writeExistingFiles(config);
      expect(fs.outputFile.mock.calls).toMatchSnapshot();
      expect(fs.outputFile.mock.calls).toHaveLength(3);
      expect(fs.remove.mock.calls).toHaveLength(0);
    });
  });
  describe('writeUpdatedPackageFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        logger,
        tmpDir: { path: 'some-tmp-dir' },
      };
      fs.outputFile = jest.fn();
    });
    it('returns if no updated packageFiles', async () => {
      delete config.updatedPackageFiles;
      await writeUpdatedPackageFiles(config);
      expect(fs.outputFile.mock.calls).toHaveLength(0);
    });
    it('returns if no updated packageFiles are package.json', async () => {
      config.updatedPackageFiles = [
        {
          name: 'Dockerfile',
          contents: 'some-contents',
        },
      ];
      await writeUpdatedPackageFiles(config);
      expect(fs.outputFile.mock.calls).toHaveLength(0);
    });
    it('writes updated packageFiles', async () => {
      config.updatedPackageFiles = [
        {
          name: 'package.json',
          contents: '{ "name": "{{some-template}}" }',
        },
        {
          name: 'backend/package.json',
          contents:
            '{ "name": "some-other-name", "engines": { "node": "^6.0.0" }}',
        },
      ];
      await writeUpdatedPackageFiles(config);
      expect(fs.outputFile.mock.calls).toMatchSnapshot();
      expect(fs.outputFile.mock.calls).toHaveLength(2);
      expect(fs.outputFile.mock.calls[1][1].includes('"engines"')).toBe(false);
    });
  });
  describe('getUpdatedLockFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        api: {
          branchExists: jest.fn(),
          getFileContent: jest.fn(() => 'some lock file contents'),
        },
        logger,
        tmpDir: { path: 'some-tmp-dir' },
      };
      npm.generateLockFile = jest.fn();
      npm.generateLockFile.mockReturnValue({
        lockFile: 'some lock file contents',
      });
      yarn.generateLockFile = jest.fn();
      yarn.generateLockFile.mockReturnValue({
        lockFile: 'some lock file contents',
      });
      lockFiles.determineLockFileDirs = jest.fn();
    });
    it('returns no error and empty lockfiles if lock file maintenance exists', async () => {
      config.type = 'lockFileMaintenance';
      config.api.branchExists.mockReturnValueOnce(true);
      const res = await getUpdatedLockFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(0);
    });
    it('returns no error and empty lockfiles if none updated', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        packageLockFileDirs: [],
        yarnLockFileDirs: [],
      });
      const res = await getUpdatedLockFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(0);
    });
    it('tries multiple lock files', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        packageLockFileDirs: ['a', 'b'],
        yarnLockFileDirs: ['c', 'd'],
      });
      const res = await getUpdatedLockFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(0);
      expect(npm.generateLockFile.mock.calls).toHaveLength(2);
      expect(yarn.generateLockFile.mock.calls).toHaveLength(2);
      expect(config.api.getFileContent.mock.calls).toHaveLength(4);
    });
    it('sets error if receiving null', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        packageLockFileDirs: ['a', 'b'],
        yarnLockFileDirs: ['c', 'd'],
      });
      npm.generateLockFile.mockReturnValueOnce({ error: true });
      yarn.generateLockFile.mockReturnValueOnce({ error: true });
      const res = await getUpdatedLockFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(2);
      expect(res.updatedLockFiles).toHaveLength(0);
      expect(npm.generateLockFile.mock.calls).toHaveLength(2);
      expect(yarn.generateLockFile.mock.calls).toHaveLength(2);
      expect(config.api.getFileContent.mock.calls).toHaveLength(2);
    });
    it('adds multiple lock files', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        packageLockFileDirs: ['a', 'b'],
        yarnLockFileDirs: ['c', 'd'],
      });
      npm.generateLockFile.mockReturnValueOnce('some new lock file contents');
      yarn.generateLockFile.mockReturnValueOnce('some new lock file contents');
      const res = await getUpdatedLockFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(2);
      expect(npm.generateLockFile.mock.calls).toHaveLength(2);
      expect(yarn.generateLockFile.mock.calls).toHaveLength(2);
      expect(config.api.getFileContent.mock.calls).toHaveLength(4);
    });
  });
});
