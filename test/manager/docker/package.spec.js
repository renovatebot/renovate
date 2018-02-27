const dockerApi = require('../../../lib/datasource/docker');
const docker = require('../../../lib/manager/docker/package');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

// jest.mock('../../../lib/manager/docker/registry');
dockerApi.getDigest = jest.fn();
dockerApi.getTags = jest.fn();

describe('lib/workers/package/docker', () => {
  describe('isStable', () => {
    it('returns true if no pattern', () => {
      expect(docker.isStable('8', null)).toBe(true);
    });
    it('returns true if no match', () => {
      const unstablePattern = '^\\d*[13579]($|.)';
      expect(docker.isStable('8', unstablePattern)).toBe(true);
      expect(docker.isStable('8.9.1', unstablePattern)).toBe(true);
    });
    it('returns false if match', () => {
      const unstablePattern = '^\\d*[13579]($|.)';
      expect(docker.isStable('9.0', unstablePattern)).toBe(false);
      expect(docker.isStable('15.04', unstablePattern)).toBe(false);
    });
  });
  describe('getPackageUpdates', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        depName: 'some-dep',
        currentFrom: 'some-dep:1.0.0@sha256:abcdefghijklmnop',
        currentDepTag: 'some-dep:1.0.0',
        currentTag: '1.0.0',
        currentDigest: 'sha256:abcdefghijklmnop',
      };
    });
    it('returns empty if no digest', async () => {
      expect(await docker.getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if digest is same', async () => {
      dockerApi.getDigest.mockReturnValueOnce(config.currentDigest);
      expect(await docker.getPackageUpdates(config)).toEqual([]);
    });
    it('returns a digest', async () => {
      dockerApi.getDigest.mockReturnValueOnce('sha256:1234567890');
      const res = await docker.getPackageUpdates(config);
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('digest');
    });
    it('adds latest tag', async () => {
      delete config.currentTag;
      dockerApi.getDigest.mockReturnValueOnce('sha256:1234567890');
      const res = await docker.getPackageUpdates(config);
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('digest');
    });
    it('returns a pin', async () => {
      delete config.currentDigest;
      dockerApi.getDigest.mockReturnValueOnce('sha256:1234567890');
      const res = await docker.getPackageUpdates(config);
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('pin');
    });
    it('returns empty if current tag is not valid version', async () => {
      config.currentTag = 'some-text-tag';
      dockerApi.getDigest.mockReturnValueOnce(config.currentDigest);
      expect(await docker.getPackageUpdates(config)).toEqual([]);
    });
    it('returns only one upgrade if automerging major', async () => {
      dockerApi.getDigest.mockReturnValueOnce(config.currentDigest);
      dockerApi.getDigest.mockReturnValueOnce('sha256:one');
      dockerApi.getTags.mockReturnValueOnce([
        '1.1.0',
        '1.2.0',
        '2.0.0',
        '3.0.0',
      ]);
      config.major.automerge = true;
      const res = await docker.getPackageUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].newVersionMajor).toEqual('3');
      config.major.automerge = false;
    });
    it('returns major and minor upgrades', async () => {
      config.multipleMajorPrs = true;
      dockerApi.getDigest.mockReturnValueOnce(config.currentDigest);
      dockerApi.getDigest.mockReturnValueOnce('sha256:one');
      dockerApi.getDigest.mockReturnValueOnce('sha256:two');
      dockerApi.getDigest.mockReturnValueOnce('sha256:three');
      dockerApi.getTags.mockReturnValueOnce([
        '1.1.0',
        '1.2.0',
        '2.0.0',
        '3.0.0',
      ]);
      const res = await docker.getPackageUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
      expect(res[0].type).toEqual('minor');
      expect(res[0].newVersion).toEqual('1.2.0');
      expect(res[1].type).toEqual('major');
      expect(res[2].newVersionMajor).toEqual('3');
    });
    it('returns only one major', async () => {
      dockerApi.getDigest.mockReturnValueOnce(config.currentDigest);
      dockerApi.getDigest.mockReturnValueOnce('sha256:one');
      dockerApi.getDigest.mockReturnValueOnce('sha256:two');
      dockerApi.getTags.mockReturnValueOnce([
        '1.1.0',
        '1.2.0',
        '2.0.0',
        '3.0.0',
      ]);
      const res = await docker.getPackageUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
      expect(res[0].type).toEqual('minor');
      expect(res[0].newVersion).toEqual('1.2.0');
      expect(res[1].type).toEqual('major');
      expect(res[1].newVersionMajor).toEqual('3');
    });
    it('returns only one upgrade', async () => {
      dockerApi.getDigest.mockReturnValueOnce(config.currentDigest);
      dockerApi.getDigest.mockReturnValueOnce('sha256:one');
      dockerApi.getTags.mockReturnValueOnce([
        '1.1.0',
        '1.2.0',
        '2.0.0',
        '3.0.0',
      ]);
      config.major.automerge = true;
      const res = await docker.getPackageUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('major');
      expect(res[0].newVersionMajor).toEqual('3');
    });
    it('ignores unstable upgrades', async () => {
      config = {
        ...defaultConfig,
        depName: 'node',
        currentFrom: 'node:6',
        currentDepTag: 'node:6',
        currentTag: '6',
        currentDigest: undefined,
        pinDigests: false,
        unstablePattern: '^\\d*[13579]($|.)',
      };
      dockerApi.getTags.mockReturnValueOnce(['4', '6', '6.1', '7', '8', '9']);
      const res = await docker.getPackageUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('major');
      expect(res[0].newVersion).toEqual('8');
    });
    it('upgrades from unstable to stable', async () => {
      config = {
        ...defaultConfig,
        depName: 'node',
        currentFrom: 'node:7',
        currentDepTag: 'node:7',
        currentTag: '7',
        currentDigest: undefined,
        pinDigests: false,
        unstablePattern: '^\\d*[13579]($|.)',
      };
      dockerApi.getTags.mockReturnValueOnce(['4', '6', '6.1', '7', '8', '9']);
      const res = await docker.getPackageUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('major');
      expect(res[0].newVersion).toEqual('8');
    });
    it('upgrades from unstable to unstable if not ignoring', async () => {
      config = {
        ...defaultConfig,
        depName: 'node',
        currentFrom: 'node:7',
        currentDepTag: 'node:7',
        currentTag: '7',
        currentDigest: undefined,
        pinDigests: false,
        unstablePattern: '^\\d*[13579]($|.)',
        ignoreUnstable: false,
      };
      dockerApi.getTags.mockReturnValueOnce(['4', '6', '6.1', '7', '8', '9']);
      const res = await docker.getPackageUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].newVersionMajor).toEqual('9');
    });
    it('adds digest', async () => {
      delete config.currentDigest;
      config.currentTag = '1.0.0-something';
      dockerApi.getDigest.mockReturnValueOnce('sha256:one');
      dockerApi.getTags.mockReturnValueOnce([
        '1.1.0-something',
        '1.2.0-otherthing',
      ]);
      const res = await docker.getPackageUpdates(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
      expect(res[1].type).toEqual('minor');
      expect(res[1].newVersion).toEqual('1.1.0-something');
    });
    it('ignores deps with custom registry', async () => {
      delete config.currentDigest;
      config.dockerRegistry = 'registry.something.info:5005';
      const res = await docker.getPackageUpdates(config);
      expect(res).toHaveLength(0);
    });
  });
});
