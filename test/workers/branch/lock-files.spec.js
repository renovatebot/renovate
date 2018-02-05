const fs = require('fs-extra');
const lockFiles = require('../../../lib/workers/branch/lock-files');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const upath = require('upath');

const npm = require('../../../lib/workers/branch/npm');
const yarn = require('../../../lib/workers/branch/yarn');
const pnpm = require('../../../lib/workers/branch/pnpm');
const lerna = require('../../../lib/workers/branch/lerna');

const {
  hasPackageLock,
  hasYarnLock,
  hasShrinkwrapYaml,
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
  describe('hasShrinkWrapYaml', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
    });
    it('returns true if found and true', () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          shrinkwrapYaml: 'some shrinkwrap',
        },
      ];
      expect(hasShrinkwrapYaml(config, 'package.json')).toBe(true);
    });
    it('returns false if found and false', () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          shrinkwrapYaml: 'some shrinkwrap',
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      expect(hasShrinkwrapYaml(config, 'backend/package.json')).toBe(false);
    });
    it('throws error if not found', () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          shrinkwrapYaml: 'some package lock',
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      let e;
      try {
        hasShrinkwrapYaml(config, 'frontend/package.json');
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
        packageFiles: [
          {
            packageFile: 'package.json',
            yarnLock: '# some yarn lock',
          },
          {
            packageFile: 'backend/package.json',
            packageLock: 'some package lock',
          },
          {
            packageFile: 'frontend/package.json',
            shrinkwrapYaml: 'some package lock',
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
        {
          name: 'frontend/package.json',
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
    it('returns root directory if using lerna package lock', () => {
      config.lernaLockFile = 'yarn';
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
      expect(res.yarnLockFileDirs).toHaveLength(0);
      expect(res.lernaDirs).toHaveLength(1);
      expect(res.lernaDirs[0]).toEqual('.');
    });
  });
  describe('writeExistingFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
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
      expect(fs.outputFile.mock.calls).toHaveLength(6);
      expect(fs.remove.mock.calls).toHaveLength(6);
    });
    it('writes package.json of local lib', async () => {
      const renoPath = upath.join(__dirname, '../../../');
      config.copyLocalLibs = true;
      config.tmpDir = { path: renoPath };
      config.packageFiles = [
        {
          packageFile: 'client/package.json',
          content: {
            name: 'package 1',
            dependencies: {
              test: 'file:../test.tgz',
              testFolder: 'file:../test',
            },
          },
          yarnLock: 'some yarn lock',
          packageLock: 'some package lock',
        },
      ];
      platform.getFile.mockReturnValue('some lock file contents');
      await writeExistingFiles(config);
      expect(fs.outputFile.mock.calls).toHaveLength(5);
      expect(fs.remove.mock.calls).toHaveLength(1);
    });
    it('Try to write package.json of local lib, but file not found', async () => {
      const renoPath = upath.join(__dirname, '../../../');
      config.copyLocalLibs = true;
      config.tmpDir = { path: renoPath };
      config.packageFiles = [
        {
          packageFile: 'client/package.json',
          content: {
            name: 'package 1',
            dependencies: {
              test: 'file:../test.tgz',
              testFolder: 'file:../test',
            },
          },
          yarnLock: 'some yarn lock',
          packageLock: 'some package lock',
        },
      ];
      platform.getFile.mockReturnValue(null);
      await writeExistingFiles(config);
      expect(fs.outputFile.mock.calls).toHaveLength(3);
      expect(fs.remove.mock.calls).toHaveLength(1);
    });
    it('detect malicious intent (error config in package.json) local lib is not in the repo', async () => {
      const renoPath = upath.join(__dirname, '../../../');
      config.copyLocalLibs = true;
      config.tmpDir = { path: renoPath };
      config.packageFiles = [
        {
          packageFile: 'client/package.json',
          content: {
            name: 'package 1',
            dependencies: {
              test: 'file:../test.tgz',
              testFolder: 'file:../../../../test',
            },
          },
          yarnLock: 'some yarn lock',
          packageLock: 'some package lock',
        },
      ];
      platform.getFile.mockReturnValue(null);
      await writeExistingFiles(config);
      expect(fs.outputFile.mock.calls).toHaveLength(3);
      expect(fs.remove.mock.calls).toHaveLength(1);
    });
  });
  describe('writeUpdatedPackageFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
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
      expect(fs.outputFile.mock.calls).toHaveLength(2);
      expect(fs.outputFile.mock.calls[1][1].includes('"engines"')).toBe(false);
    });
  });
  describe('getUpdatedLockFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        tmpDir: { path: 'some-tmp-dir' },
      };
      platform.getFile.mockReturnValue('some lock file contents');
      npm.generateLockFile = jest.fn();
      npm.generateLockFile.mockReturnValue({
        lockFile: 'some lock file contents',
      });
      yarn.generateLockFile = jest.fn();
      yarn.generateLockFile.mockReturnValue({
        lockFile: 'some lock file contents',
      });
      pnpm.generateLockFile = jest.fn();
      pnpm.generateLockFile.mockReturnValue({
        lockFile: 'some lock file contents',
      });
      lerna.generateLockFiles = jest.fn();
      lockFiles.determineLockFileDirs = jest.fn();
    });
    afterEach(() => {
      jest.resetAllMocks();
    });
    it('returns no error and empty lockfiles if lock file maintenance exists', async () => {
      config.type = 'lockFileMaintenance';
      platform.branchExists.mockReturnValueOnce(true);
      const res = await getUpdatedLockFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(0);
    });
    it('returns no error and empty lockfiles if none updated', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        packageLockFileDirs: [],
        yarnLockFileDirs: [],
        shrinkwrapYamlDirs: [],
        lernaDirs: [],
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
        shrinkwrapYamlDirs: ['e'],
        lernaDirs: [],
      });
      const res = await getUpdatedLockFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(0);
      expect(npm.generateLockFile.mock.calls).toHaveLength(2);
      expect(yarn.generateLockFile.mock.calls).toHaveLength(2);
      expect(platform.getFile.mock.calls).toHaveLength(6);
    });
    it('tries lerna npm', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        packageLockFileDirs: ['a', 'b'],
        yarnLockFileDirs: [],
        shrinkwrapYamlDirs: [],
        lernaDirs: ['.'],
      });
      config.lernaLockFile = 'npm';
      lerna.generateLockFiles.mockReturnValueOnce({ error: false });
      const res = await getUpdatedLockFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('tries lerna yarn', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        packageLockFileDirs: [],
        yarnLockFileDirs: ['c', 'd'],
        shrinkwrapYamlDirs: [],
        lernaDirs: ['.'],
      });
      config.lernaLockFile = 'yarn';
      lerna.generateLockFiles.mockReturnValueOnce({ error: true });
      const res = await getUpdatedLockFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('sets error if receiving null', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        packageLockFileDirs: ['a', 'b'],
        yarnLockFileDirs: ['c', 'd'],
        shrinkwrapYamlDirs: ['e'],
        lernaDirs: [],
      });
      npm.generateLockFile.mockReturnValueOnce({ error: true });
      yarn.generateLockFile.mockReturnValueOnce({ error: true });
      pnpm.generateLockFile.mockReturnValueOnce({ error: true });
      const res = await getUpdatedLockFiles(config);
      expect(res.lockFileErrors).toHaveLength(3);
      expect(res.updatedLockFiles).toHaveLength(0);
      expect(npm.generateLockFile.mock.calls).toHaveLength(2);
      expect(yarn.generateLockFile.mock.calls).toHaveLength(2);
      expect(platform.getFile.mock.calls).toHaveLength(3);
    });
    it('adds multiple lock files', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        packageLockFileDirs: ['a', 'b'],
        yarnLockFileDirs: ['c', 'd'],
        shrinkwrapYamlDirs: ['e'],
        lernaDirs: [],
      });
      npm.generateLockFile.mockReturnValueOnce('some new lock file contents');
      yarn.generateLockFile.mockReturnValueOnce('some new lock file contents');
      pnpm.generateLockFile.mockReturnValueOnce('some new lock file contents');
      const res = await getUpdatedLockFiles(config);
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(3);
      expect(npm.generateLockFile.mock.calls).toHaveLength(2);
      expect(yarn.generateLockFile.mock.calls).toHaveLength(2);
      expect(platform.getFile.mock.calls).toHaveLength(6);
    });
  });
});
