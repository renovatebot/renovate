const dockerApi = require('../../../lib/api/docker');
const docker = require('../../../lib/workers/package/docker');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const logger = require('../../_fixtures/logger');

// jest.mock('../../../lib/api/docker');
dockerApi.getDigest = jest.fn();

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
  });
});
