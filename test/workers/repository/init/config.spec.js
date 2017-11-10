let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../_fixtures/config');
  config.errors = [];
  config.warnings = [];
});

const {
  mergeRenovateConfig,
} = require('../../../../lib/workers/repository/init/config');

describe('workers/repository/init/config', () => {
  describe('mergeRenovateConfig()', () => {
    it('returns config if not found', async () => {
      platform.getFileList.mockReturnValue(['package.json']);
      const res = await mergeRenovateConfig(config);
      expect(res).toMatchObject(config);
    });
    it('returns error if cannot parse', async () => {
      platform.getFileList.mockReturnValue(['package.json', 'renovate.json']);
      platform.getFile.mockReturnValue('cannot parse');
      const res = await mergeRenovateConfig(config);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toMatchSnapshot();
    });
    it('returns error if duplicate keys', async () => {
      platform.getFileList.mockReturnValue(['package.json', '.renovaterc']);
      platform.getFile.mockReturnValue('{ "enabled": true, "enabled": false }');
      const res = await mergeRenovateConfig(config);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toMatchSnapshot();
    });
    it('finds .renovaterc.json', async () => {
      platform.getFileList.mockReturnValue([
        'package.json',
        '.renovaterc.json',
      ]);
      platform.getFile.mockReturnValue('{}');
      await mergeRenovateConfig(config);
    });
  });
});
