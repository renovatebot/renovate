import {
  RenovateConfig,
  fs,
  getConfig,
  mocked,
  platform,
} from '../../../../test/util';
import * as _migrateAndValidate from '../../../config/migrate-validate';
import { mergeRenovateConfig } from './config';

jest.mock('../../../util/fs');

const migrateAndValidate = mocked(_migrateAndValidate);

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  config.errors = [];
  config.warnings = [];
});

jest.mock('../../../config/migrate-validate');

describe('workers/repository/init/config', () => {
  describe('mergeRenovateConfig()', () => {
    beforeEach(() => {
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        warnings: [],
        errors: [],
      });
    });
    it('returns config if not found', async () => {
      platform.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      const res = await mergeRenovateConfig(config);
      expect(res).toMatchObject(config);
    });
    it('uses package.json config if found', async () => {
      platform.getFileList.mockResolvedValue(['package.json']);
      const pJson = JSON.stringify({
        name: 'something',
        renovate: {
          prHourlyLimit: 10,
        },
      });
      fs.readLocalFile.mockResolvedValue(pJson);
      await mergeRenovateConfig(config);
    });
    it('returns error if cannot parse', async () => {
      platform.getFileList.mockResolvedValue(['package.json', 'renovate.json']);
      fs.readLocalFile.mockResolvedValue('cannot parse');
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
      platform.getFileList.mockResolvedValue(['package.json', '.renovaterc']);
      fs.readLocalFile.mockResolvedValue(
        '{ "enabled": true, "enabled": false }'
      );
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
    it('finds and parse renovate.json5', async () => {
      platform.getFileList.mockResolvedValue([
        'package.json',
        'renovate.json5',
      ]);
      fs.readLocalFile.mockResolvedValue(`{
        // this is json5 format
      }`);
      await mergeRenovateConfig(config);
    });
    it('finds .github/renovate.json', async () => {
      platform.getFileList.mockResolvedValue([
        'package.json',
        '.github/renovate.json',
      ]);
      fs.readLocalFile.mockResolvedValue('{}');
      await mergeRenovateConfig(config);
    });
    it('finds .gitlab/renovate.json', async () => {
      platform.getFileList.mockResolvedValue([
        'package.json',
        '.gitlab/renovate.json',
      ]);
      fs.readLocalFile.mockResolvedValue('{}');
      await mergeRenovateConfig(config);
    });
    it('finds .renovaterc.json', async () => {
      platform.getFileList.mockResolvedValue([
        'package.json',
        '.renovaterc.json',
      ]);
      fs.readLocalFile.mockResolvedValue('{}');
      await mergeRenovateConfig(config);
    });
    it('throws error if misconfigured', async () => {
      platform.getFileList.mockResolvedValue([
        'package.json',
        '.renovaterc.json',
      ]);
      fs.readLocalFile.mockResolvedValue('{}');
      migrateAndValidate.migrateAndValidate.mockResolvedValueOnce({
        errors: [{ depName: 'dep', message: 'test error' }],
      });
      let e: Error;
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
