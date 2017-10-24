const dockerApi = require('../../../lib/api/docker');
const docker = require('../../../lib/workers/package/docker');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const logger = require('../../_fixtures/logger');

// jest.mock('../../../lib/api/docker');
dockerApi.getDigest = jest.fn();
dockerApi.getTags = jest.fn();

describe('lib/workers/package/docker', () => {
  describe('renovateDockerImage', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        logger,
        depName: 'some-dep',
        currentTag: '1.0.0',
        currentDigest: 'sha256:abcdefghijklmnop',
      };
    });
    it('returns empty if no digest', async () => {
      expect(await docker.renovateDockerImage(config)).toEqual([]);
    });
    it('returns empty if digest is same', async () => {
      dockerApi.getDigest.mockReturnValueOnce(config.currentDigest);
      expect(await docker.renovateDockerImage(config)).toEqual([]);
    });
    it('returns a digest', async () => {
      dockerApi.getDigest.mockReturnValueOnce('sha256:1234567890');
      const res = await docker.renovateDockerImage(config);
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('digest');
    });
    it('returns a pin', async () => {
      delete config.currentDigest;
      dockerApi.getDigest.mockReturnValueOnce('sha256:1234567890');
      const res = await docker.renovateDockerImage(config);
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('pin');
    });
    it('returns empty if current tag is not valid version', async () => {
      config.currentTag = 'some-text-tag';
      dockerApi.getDigest.mockReturnValueOnce(config.currentDigest);
      expect(await docker.renovateDockerImage(config)).toEqual([]);
    });
    it('returns major and minor upgrades', async () => {
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
      const res = await docker.renovateDockerImage(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
      expect(res[0].type).toEqual('minor');
      expect(res[0].newVersion).toEqual('1.2.0');
      expect(res[1].type).toEqual('major');
      expect(res[2].newVersionMajor).toEqual('3');
    });
    it('adds digest', async () => {
      delete config.currentDigest;
      config.currentTag = '1.0.0-something';
      dockerApi.getDigest.mockReturnValueOnce('sha256:one');
      dockerApi.getTags.mockReturnValueOnce([
        '1.1.0-something',
        '1.2.0-otherthing',
      ]);
      const res = await docker.renovateDockerImage(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
      expect(res[1].type).toEqual('minor');
      expect(res[1].newVersion).toEqual('1.1.0-something');
    });
  });
});
