const mergeRenovateJson = require('../../../lib/workers/repository/merge-renovate-json');
const logger = require('../../_fixtures/logger');

describe('workers/repository/merge-renovate-json', () => {
  describe('mergeRenovateJson(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        api: {
          getFileJson: jest.fn(),
        },
        logger,
      };
    });
    it('returns same config if no renovate.json found', async () => {
      expect(await mergeRenovateJson(config)).toEqual(config);
    });
    it('returns extended config if renovate.json found', async () => {
      config.api.getFileJson.mockReturnValueOnce({ foo: 1 });
      const returnConfig = await mergeRenovateJson(config);
      expect(returnConfig.foo).toBe(1);
      expect(returnConfig.renovateJsonPresent).toBe(true);
    });
  });
});
