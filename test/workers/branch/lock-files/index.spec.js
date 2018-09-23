const fs = require('fs-extra');
const lockFiles = require('../../../../lib/manager/npm/post-update');
const defaultConfig = require('../../../../lib/config/defaults').getConfig();
// const upath = require('upath');

const npm = require('../../../../lib/manager/npm/post-update/npm');
const yarn = require('../../../../lib/manager/npm/post-update/yarn');
const pnpm = require('../../../../lib/manager/npm/post-update/pnpm');
const lerna = require('../../../../lib/manager/npm/post-update/lerna');

const hostRules = require('../../../../lib/util/host-rules');

hostRules.find = jest.fn(() => 'token-abc');

const {
  // determineLockFileDirs,
  // writeExistingFiles,
  writeUpdatedPackageFiles,
  getAdditionalFiles,
} = lockFiles;

describe('manager/npm/post-update', () => {
  /*
  describe('determineLockFileDirs', () => {
    let config;
    let packageFiles;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
      packageFiles = [
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
          pnpmShrinkwrap: 'some package lock',
        },
        {
          packageFile: 'leftend/package.json',
          npmShrinkwrap: 'some package lock',
        },
      ];
    });
    it('returns all directories if lock file maintenance', () => {
      config.upgrades = [{ updateType: 'lockFileMaintenance' }];
      const res = determineLockFileDirs(config, packageFiles);
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
        {
          name: 'leftend/package.json',
          contents: 'some contents',
        },
      ];
      const res = determineLockFileDirs(config, packageFiles);
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
      expect(res.npmLockDirs).toHaveLength(0);
      expect(res.yarnLockDirs).toHaveLength(1);
      expect(res.yarnLockDirs[0]).toEqual('.');
    });
    it('returns root directory if using lerna package lock', () => {
      config.lernaClient = 'yarn';
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
      expect(res.npmLockDirs).toHaveLength(0);
      expect(res.yarnLockDirs).toHaveLength(0);
      expect(res.lernaDirs).toHaveLength(1);
      expect(res.lernaDirs[0]).toEqual('.');
    });
  });
  describe('writeExistingFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        localDir: 'some-tmp-dir',
      };
      fs.outputFile = jest.fn();
      fs.remove = jest.fn();
    });
    it('returns if no packageFiles', async () => {
      config.npmrc = 'some-npmrc';
      config.yarnrc = 'some-yarnrc';
      await writeExistingFiles(config, {});
      expect(fs.outputFile.mock.calls).toHaveLength(2);
    });
    it('writes files and removes files', async () => {
      config.npmrc = 'some-npmrc';
      const packageFiles = {
        npm: [
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
          {
            packageFile: 'leftend/package.json',
            hasNpmShrinkwrap: true,
            content: { name: 'package-3' },
          },
        ],
      };
      await writeExistingFiles(config, packageFiles);
      expect(fs.outputFile.mock.calls).toHaveLength(7);
      expect(fs.remove.mock.calls).toHaveLength(9);
    });
    it('writes package.json of local lib', async () => {
      const renoPath = upath.join(__dirname, '../../../');
      config.localDir = renoPath;
      const packageFiles = {
        npm: [
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
        ],
      };
      platform.getFile.mockReturnValue('some lock file contents');
      await writeExistingFiles(config, packageFiles);
      expect(fs.outputFile.mock.calls).toHaveLength(5);
      expect(fs.remove.mock.calls).toHaveLength(1);
    });
    it('Try to write package.json of local lib, but file not found', async () => {
      const renoPath = upath.join(__dirname, '../../../');
      config.localDir = renoPath;
      const packageFiles = {
        npm: [
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
        ],
      };
      platform.getFile.mockReturnValue(null);
      await writeExistingFiles(config, packageFiles);
      expect(fs.outputFile.mock.calls).toHaveLength(3);
      expect(fs.remove.mock.calls).toHaveLength(1);
    });
    it('detect malicious intent (error config in package.json) local lib is not in the repo', async () => {
      const renoPath = upath.join(__dirname, '../../../');
      config.localDir = renoPath;
      const packageFiles = {
        npm: [
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
        ],
      };
      platform.getFile.mockReturnValue(null);
      await writeExistingFiles(config, packageFiles);
      expect(fs.outputFile.mock.calls).toHaveLength(3);
      expect(fs.remove.mock.calls).toHaveLength(1);
    });
  });
  */
  describe('writeUpdatedPackageFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        localDir: 'some-tmp-dir',
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
      config.upgrades = [];
      await writeUpdatedPackageFiles(config);
      expect(fs.outputFile.mock.calls).toHaveLength(2);
      expect(fs.outputFile.mock.calls[1][1].includes('"engines"')).toBe(false);
    });
  });
  describe('getAdditionalFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        localDir: 'some-tmp-dir',
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
    it('returns no error and empty lockfiles if updateLockFiles false', async () => {
      config.updateLockFiles = false;
      const res = await getAdditionalFiles(config, { npm: [{}] });
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(0);
    });
    it('returns no error and empty lockfiles if lock file maintenance exists', async () => {
      config.updateType = 'lockFileMaintenance';
      config.parentBranch = 'renovate/lock-file-maintenance';
      platform.branchExists.mockReturnValueOnce(true);
      const res = await getAdditionalFiles(config, { npm: [{}] });
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(0);
    });
    /*
    it('returns no error and empty lockfiles if none updated', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        npmLockDirs: [],
        npmShrinkwrapDirs: [],
        yarnLockDirs: [],
        pnpmShrinkwrapDirs: [],
        lernaDirs: [],
      });
      const res = await getAdditionalFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(0);
    });
    it('tries multiple lock files', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        npmLockDirs: ['a', 'b'],
        npmShrinkwrapDirs: ['f'],
        yarnLockDirs: ['c', 'd'],
        pnpmShrinkwrapDirs: ['e'],
        lernaDirs: [],
      });
      const res = await getAdditionalFiles(config);
      expect(res).toMatchSnapshot();
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(0);
      expect(npm.generateLockFile.mock.calls).toHaveLength(3);
      expect(yarn.generateLockFile.mock.calls).toHaveLength(2);
      expect(platform.getFile.mock.calls).toHaveLength(7);
    });
    it('tries lerna npm', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        npmLockDirs: ['a', 'b'],
        npmShrinkwrapDirs: [],
        yarnLockDirs: [],
        pnpmShrinkwrapDirs: [],
        lernaDirs: ['.'],
      });
      config.packageFiles = [];
      config.lernaClient = 'npm';
      lerna.generateLockFiles.mockReturnValueOnce({ error: false });
      const res = await getAdditionalFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('tries lerna yarn', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        npmLockDirs: [],
        npmShrinkwrapDirs: [],
        yarnLockDirs: ['c', 'd'],
        pnpmShrinkwrapDirs: [],
        lernaDirs: ['.'],
      });
      config.lernaClient = 'yarn';
      lerna.generateLockFiles.mockReturnValueOnce({ error: true });
      const res = await getAdditionalFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('sets error if receiving null', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        npmLockDirs: ['a', 'b'],
        npmShrinkwrapDirs: ['f'],
        yarnLockDirs: ['c', 'd'],
        pnpmShrinkwrapDirs: ['e'],
        lernaDirs: [],
      });
      npm.generateLockFile.mockReturnValueOnce({ error: true });
      yarn.generateLockFile.mockReturnValueOnce({ error: true });
      pnpm.generateLockFile.mockReturnValueOnce({ error: true });
      const res = await getAdditionalFiles(config);
      expect(res.lockFileErrors).toHaveLength(3);
      expect(res.updatedLockFiles).toHaveLength(0);
      expect(npm.generateLockFile.mock.calls).toHaveLength(3);
      expect(yarn.generateLockFile.mock.calls).toHaveLength(2);
      expect(platform.getFile.mock.calls).toHaveLength(4);
    });
    it('adds multiple lock files', async () => {
      lockFiles.determineLockFileDirs.mockReturnValueOnce({
        npmLockDirs: ['a', 'b'],
        npmShrinkwrapDirs: ['f'],
        yarnLockDirs: ['c', 'd'],
        pnpmShrinkwrapDirs: ['e'],
        lernaDirs: [],
      });
      npm.generateLockFile.mockReturnValueOnce('some new lock file contents');
      yarn.generateLockFile.mockReturnValueOnce('some new lock file contents');
      pnpm.generateLockFile.mockReturnValueOnce('some new lock file contents');
      const res = await getAdditionalFiles(config);
      expect(res.lockFileErrors).toHaveLength(0);
      expect(res.updatedLockFiles).toHaveLength(3);
      expect(npm.generateLockFile.mock.calls).toHaveLength(3);
      expect(yarn.generateLockFile.mock.calls).toHaveLength(2);
      expect(platform.getFile.mock.calls).toHaveLength(7);
    });
    */
  });
});
