const packageFileWorker = require('../../../lib/workers/package-file');
const depTypeWorker = require('../../../lib/workers/dep-type');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const yarnLock = require('@yarnpkg/lockfile');

jest.mock('@yarnpkg/lockfile');

jest.mock('../../../lib/workers/dep-type');
jest.mock('../../../lib/workers/branch/schedule');

describe('packageFileWorker', () => {
  describe('renovatePackageFile(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'package.json',
        manager: 'npm',
        content: {},
        repoIsOnboarded: true,
        npmrc: '# nothing',
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toEqual([]);
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}]);
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}, {}]);
      depTypeWorker.renovateDepType.mockReturnValueOnce([]);
      depTypeWorker.renovateDepType.mockReturnValueOnce([]);
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(3);
    });
    it('autodetects dependency pinning true if private', async () => {
      config.pinVersions = null;
      config.content.private = true;
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(0);
    });
    it('autodetects dependency pinning true if no main', async () => {
      config.pinVersions = null;
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(0);
    });
    it('autodetects dependency pinning true', async () => {
      config.pinVersions = null;
      config.content.main = 'something';
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(0);
    });
    it('maintains lock files', async () => {
      config.lockFileMaintenance.enabled = true;
      config.yarnLock = '# some yarn lock';
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(1);
    });
    it('uses workspaces yarn.lock', async () => {
      config.workspaceDir = '.';
      platform.getFile.mockReturnValueOnce('# yarn lock');
      await packageFileWorker.renovatePackageFile(config);
    });
    it('skips unparseable yarn.lock', async () => {
      config.yarnLock = 'yarn.lock';
      await packageFileWorker.renovatePackageFile(config);
    });
    it('skips unparseable yarn.lock', async () => {
      config.yarnLock = 'yarn.lock';
      yarnLock.parse.mockReturnValueOnce({ type: 'failure' });
      await packageFileWorker.renovatePackageFile(config);
    });
    it('uses workspace yarn.lock', async () => {
      config.workspaceDir = '.';
      yarnLock.parse.mockReturnValueOnce({ type: 'success' });
      await packageFileWorker.renovatePackageFile(config);
    });
    it('skips unparseable package-lock.json', async () => {
      config.packageLock = 'package-lock.lock';
      await packageFileWorker.renovatePackageFile(config);
    });
    it('parses package-lock.json', async () => {
      config.packageLock = 'package-lock.lock';
      platform.getFile.mockReturnValueOnce('{}');
      await packageFileWorker.renovatePackageFile(config);
    });
  });
  describe('renovateMeteorPackageFile(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'package.js',
        manager: 'meteor',
        repoIsOnboarded: true,
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toEqual([]);
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}, {}]);
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(2);
    });
  });
  describe('renovateBazelFile(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'WORKSPACE',
        manager: 'bazel',
        repoIsOnboarded: true,
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toEqual([]);
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}, {}]);
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(2);
    });
  });
  describe('renovateNodeFile(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: '.travis.yml',
        manager: 'travis',
        repoIsOnboarded: true,
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toEqual([]);
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}]);
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(1);
    });
  });
  describe('renovateDockerfile', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'Dockerfile',
        manager: 'docker',
        repoIsOnboarded: true,
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toEqual([]);
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}, {}]);
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(2);
    });
  });
});
