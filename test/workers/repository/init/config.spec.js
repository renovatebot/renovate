let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../_fixtures/config');
  config.errors = [];
  config.warnings = [];
});

const {
  mergeRenovateJson,
} = require('../../../../lib/workers/repository/init/config');

describe('workers/repository/init/config', () => {
  describe('mergeRenovateJson()', () => {
    it('returns config if not found', async () => {
      const res = await mergeRenovateJson(config);
      expect(res).toMatchObject(config);
    });
    it('returns error if cannot parse', async () => {
      platform.getFileContent.mockReturnValue('cannot parse');
      const res = await mergeRenovateJson(config);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toMatchSnapshot();
    });
    it('returns error if duplicate keys', async () => {
      platform.getFileContent.mockReturnValue(
        '{ "enabled": true, "enabled": false }'
      );
      const res = await mergeRenovateJson(config);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toMatchSnapshot();
    });
  });
});
