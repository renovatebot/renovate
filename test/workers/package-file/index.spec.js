const packageFileWorker = require('../../../lib/workers/package-file');
const depTypeWorker = require('../../../lib/workers/dep-type');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const yarnLock = require('@yarnpkg/lockfile');

jest.mock('@yarnpkg/lockfile');

jest.mock('../../../lib/workers/dep-type');
jest.mock('../../../lib/workers/branch/schedule');

describe('packageFileWorker', () => {
  describe('renovatePackageJson(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'package.json',
        content: {},
        repoIsOnboarded: true,
        npmrc: '# nothing',
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovatePackageJson(config);
      expect(res).toEqual([]);
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}]);
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}, {}]);
      depTypeWorker.renovateDepType.mockReturnValueOnce([]);
      depTypeWorker.renovateDepType.mockReturnValueOnce([]);
      const res = await packageFileWorker.renovatePackageJson(config);
      expect(res).toHaveLength(3);
    });
    it('autodetects dependency pinning true if private', async () => {
      config.pinVersions = null;
      config.content.private = true;
      const res = await packageFileWorker.renovatePackageJson(config);
      expect(res).toHaveLength(0);
    });
    it('autodetects dependency pinning true if no main', async () => {
      config.pinVersions = null;
      const res = await packageFileWorker.renovatePackageJson(config);
      expect(res).toHaveLength(0);
    });
    it('autodetects dependency pinning true', async () => {
      config.pinVersions = null;
      config.content.main = 'something';
      const res = await packageFileWorker.renovatePackageJson(config);
      expect(res).toHaveLength(0);
    });
    it('maintains lock files', async () => {
      config.lockFileMaintenance.enabled = true;
      config.yarnLock = '# some yarn lock';
      const res = await packageFileWorker.renovatePackageJson(config);
      expect(res).toHaveLength(1);
    });
    it('uses workspaces yarn.lock', async () => {
      config.workspaceDir = '.';
      platform.getFile.mockReturnValueOnce('# yarn lock');
      await packageFileWorker.renovatePackageJson(config);
    });
    it('skips unparseable yarn.lock', async () => {
      config.yarnLock = 'yarn.lock';
      await packageFileWorker.renovatePackageJson(config);
    });
    it('skips unparseable yarn.lock', async () => {
      config.yarnLock = 'yarn.lock';
      yarnLock.parse.mockReturnValueOnce({ type: 'failure' });
      await packageFileWorker.renovatePackageJson(config);
    });
    it('uses workspace yarn.lock', async () => {
      config.workspaceDir = '.';
      yarnLock.parse.mockReturnValueOnce({ type: 'success' });
      await packageFileWorker.renovatePackageJson(config);
    });
    it('skips unparseable package-lock.json', async () => {
      config.packageLock = 'package-lock.lock';
      await packageFileWorker.renovatePackageJson(config);
    });
    it('parses package-lock.json', async () => {
      config.packageLock = 'package-lock.lock';
      platform.getFile.mockReturnValueOnce('{}');
      await packageFileWorker.renovatePackageJson(config);
    });
  });
  describe('renovateMeteorPackageFile(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'package.js',
        repoIsOnboarded: true,
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovateMeteorPackageFile(config);
      expect(res).toEqual([]);
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}, {}]);
      const res = await packageFileWorker.renovateMeteorPackageFile(config);
      expect(res).toHaveLength(2);
    });
  });
  describe('renovateBazelFile(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'WORKSPACE',
        repoIsOnboarded: true,
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovateBazelFile(config);
      expect(res).toEqual([]);
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}, {}]);
      const res = await packageFileWorker.renovateBazelFile(config);
      expect(res).toHaveLength(2);
    });
  });
  describe('renovateNodeFile(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: '.travis.yml',
        repoIsOnboarded: true,
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovateNodeFile(config);
      expect(res).toEqual([]);
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}]);
      const res = await packageFileWorker.renovateNodeFile(config);
      expect(res).toHaveLength(1);
    });
  });
  describe('renovateDockerfile', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'Dockerfile',
        repoIsOnboarded: true,
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovateDockerfile(config);
      expect(res).toEqual([]);
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}, {}]);
      const res = await packageFileWorker.renovateDockerfile(config);
      expect(res).toHaveLength(2);
    });
  });
});
