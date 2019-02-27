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
const migrateValidate = require('../../../../lib/config/migrate-validate');

jest.mock('../../../../lib/config/migrate-validate');

describe('workers/repository/init/config', () => {
  describe('mergeRenovateConfig()', () => {
    beforeEach(() => {
      migrateValidate.migrateAndValidate.mockReturnValue({
        warnings: [],
        errors: [],
      });
    });
    it('returns config if not found', async () => {
      platform.getFileList.mockReturnValue(['package.json']);
      platform.getFile.mockReturnValue('{}');
      const res = await mergeRenovateConfig(config);
      expect(res).toMatchObject(config);
    });
    it('uses package.json config if found', async () => {
      platform.getFileList.mockReturnValue(['package.json']);
      const pJson = JSON.stringify({
        name: 'something',
        renovate: {
          prHourlyLimit: 10,
        },
      });
      platform.getFile.mockReturnValue(pJson);
      await mergeRenovateConfig(config);
    });
    it('returns error if cannot parse', async () => {
      platform.getFileList.mockReturnValue(['package.json', 'renovate.json']);
      platform.getFile.mockReturnValue('cannot parse');
      let e;
      try {
        await mergeRenovateConfig(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });
    it('throws error if duplicate keys', async () => {
      platform.getFileList.mockReturnValue(['package.json', '.renovaterc']);
      platform.getFile.mockReturnValue('{ "enabled": true, "enabled": false }');
      let e;
      try {
        await mergeRenovateConfig(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e.configFile).toMatchSnapshot();
      expect(e.validationError).toMatchSnapshot();
      expect(e.validationMessage).toMatchSnapshot();
    });
    it('finds .github/renovate.json', async () => {
      platform.getFileList.mockReturnValue([
        'package.json',
        '.github/renovate.json',
      ]);
      platform.getFile.mockReturnValue('{}');
      await mergeRenovateConfig(config);
    });
    it('finds .renovaterc.json', async () => {
      platform.getFileList.mockReturnValue([
        'package.json',
        '.renovaterc.json',
      ]);
      platform.getFile.mockReturnValue('{}');
      await mergeRenovateConfig(config);
    });
    it('throws error if misconfigured', async () => {
      platform.getFileList.mockReturnValue([
        'package.json',
        '.renovaterc.json',
      ]);
      platform.getFile.mockReturnValue('{}');
      migrateValidate.migrateAndValidate.mockReturnValueOnce({
        errors: [{}],
      });
      let e;
      try {
        await mergeRenovateConfig(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
      expect(e).toMatchSnapshot();
    });
  });
});
