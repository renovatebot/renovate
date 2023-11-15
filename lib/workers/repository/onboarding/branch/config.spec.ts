import { RenovateConfig, partial } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import * as presets from '../../../../config/presets/local';
import { PRESET_DEP_NOT_FOUND } from '../../../../config/presets/util';
import { getOnboardingConfig, getOnboardingConfigContents } from './config';

jest.mock('../../../../config/presets/local');

const mockedPresets = presets as jest.Mocked<typeof presets>;

describe('workers/repository/onboarding/branch/config', () => {
  let config: RenovateConfig;

  beforeAll(() => {
    GlobalConfig.set({
      localDir: '',
      platform: 'github',
    });
  });

  beforeEach(() => {
    config = partial<RenovateConfig>({
      onboardingConfig: {
        $schema: 'https://docs.renovatebot.com/renovate-schema.json',
      },
      platform: 'github',
      repository: 'some/repo',
    });
  });

  describe('getOnboardingConfigContents', () => {
    it('returns the JSON stringified onboarding config', async () => {
      mockedPresets.getPreset.mockResolvedValueOnce({ enabled: true });
      const contents = await getOnboardingConfigContents(config, '');
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(1);
      expect(contents).toEqual(
        '{\n' +
          '  "$schema": "https://docs.renovatebot.com/renovate-schema.json",\n' +
          '  "extends": [\n' +
          '    "local>some/renovate-config"\n' +
          '  ]\n' +
          '}\n',
      );
    });
  });

  describe('getOnboardingConfig', () => {
    it('handles finding an organization preset', async () => {
      mockedPresets.getPreset.mockResolvedValueOnce({ enabled: true });
      const onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(1);
      expect(onboardingConfig).toEqual({
        $schema: 'https://docs.renovatebot.com/renovate-schema.json',
        extends: ['local>some/renovate-config'],
      });
    });

    it('handles finding an organization dot platform preset', async () => {
      mockedPresets.getPreset.mockRejectedValueOnce(
        new Error(PRESET_DEP_NOT_FOUND),
      );
      mockedPresets.getPreset.mockResolvedValueOnce({ enabled: true });
      const onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(2);
      expect(onboardingConfig).toEqual({
        $schema: 'https://docs.renovatebot.com/renovate-schema.json',
        extends: ['local>some/.github:renovate-config'],
      });
    });

    it('handles not finding an organization preset', async () => {
      mockedPresets.getPreset.mockRejectedValue(
        new Error(PRESET_DEP_NOT_FOUND),
      );
      const onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(2);
      expect(onboardingConfig).toEqual(config.onboardingConfig);
    });

    it('ignores an unknown error', async () => {
      mockedPresets.getPreset.mockRejectedValue(
        new Error('unknown error for test'),
      );
      const onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(2);
      expect(onboardingConfig).toEqual(config.onboardingConfig);
    });

    it('ignores unsupported platform', async () => {
      mockedPresets.getPreset.mockRejectedValue(
        new Error(`Unsupported platform 'dummy' for local preset.`),
      );
      const onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(2);
      expect(onboardingConfig).toEqual(config.onboardingConfig);
    });
  });
});
