const packageFileWorker = require('../../../lib/workers/package-file');
const depTypeWorker = require('../../../lib/workers/dep-type');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/dep-type');
jest.mock('../../../lib/workers/branch/schedule');

describe('packageFileWorker', () => {
  describe('renovatePackageFile(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'package.json',
        content: {},
        repoIsOnboarded: true,
        npmrc: '# nothing',
        logger,
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
      config.yarnLock = '# some yarn lock';
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(1);
    });
  });
  describe('renovateMeteorPackageFile(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        api: {
          getFileContent: jest.fn(),
        },
        packageFile: 'package.js',
        repoIsOnboarded: true,
        logger,
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
  describe('renovateDockerfile', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'Dockerfile',
        repoIsOnboarded: true,
        logger,
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
