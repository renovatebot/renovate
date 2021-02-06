import {
  RenovateConfig,
  fs,
  getConfig,
  git,
  mocked,
} from '../../../../test/util';
import * as _migrateAndValidate from '../../../config/migrate-validate';
import {
  checkForRepoConfigError,
  detectRepoFileConfig,
  mergeRenovateConfig,
} from './config';

jest.mock('../../../util/fs');
jest.mock('../../../util/git');

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
  describe('detectRepoFileConfig()', () => {
    it('returns config if not found', () => {
      git.getFileList.mockResolvedValue(['package.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(detectRepoFileConfig()).toMatchSnapshot();
    });
    it('uses package.json config if found', () => {
      git.getFileList.mockResolvedValue(['package.json']);
      const pJson = JSON.stringify({
        name: 'something',
        renovate: {
          prHourlyLimit: 10,
        },
      });
      fs.readLocalFile.mockResolvedValue(pJson);
      expect(detectRepoFileConfig()).toMatchSnapshot();
    });
    it('returns error if cannot parse', () => {
      git.getFileList.mockResolvedValue(['package.json', 'renovate.json']);
      fs.readLocalFile.mockResolvedValue('cannot parse');
      expect(detectRepoFileConfig()).toMatchSnapshot();
    });
    it('throws error if duplicate keys', () => {
      git.getFileList.mockResolvedValue(['package.json', '.renovaterc']);
      fs.readLocalFile.mockResolvedValue(
        '{ "enabled": true, "enabled": false }'
      );
      expect(detectRepoFileConfig()).toMatchSnapshot();
    });
    it('finds and parse renovate.json5', () => {
      git.getFileList.mockResolvedValue(['package.json', 'renovate.json5']);
      fs.readLocalFile.mockResolvedValue(`{
        // this is json5 format
      }`);
      expect(detectRepoFileConfig()).toMatchSnapshot();
    });
    it('finds .github/renovate.json', () => {
      git.getFileList.mockResolvedValue([
        'package.json',
        '.github/renovate.json',
      ]);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(detectRepoFileConfig()).toMatchSnapshot();
    });
    it('finds .gitlab/renovate.json', () => {
      git.getFileList.mockResolvedValue([
        'package.json',
        '.gitlab/renovate.json',
      ]);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(detectRepoFileConfig()).toMatchSnapshot();
    });
    it('finds .renovaterc.json', () => {
      git.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      expect(detectRepoFileConfig()).toMatchSnapshot();
    });
  });
  describe('checkForRepoConfigError', () => {
    it('returns if no error', () => {
      expect(checkForRepoConfigError({})).toBeUndefined();
    });
    it('throws on error', () => {
      expect(() =>
        checkForRepoConfigError({
          configFileParseError: { validationError: '', validationMessage: '' },
        })
      ).toThrow();
    });
  });
  describe('mergeRenovateConfig()', () => {
    it('throws error if misconfigured', async () => {
      git.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
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
    it('continues if no errors', async () => {
      git.getFileList.mockResolvedValue(['package.json', '.renovaterc.json']);
      fs.readLocalFile.mockResolvedValue('{}');
      migrateAndValidate.migrateAndValidate.mockResolvedValue({
        warnings: [],
        errors: [],
      });
      config.extends = [':automergeDisabled'];
      expect(await mergeRenovateConfig(config)).not.toBeUndefined();
    });
  });
});
