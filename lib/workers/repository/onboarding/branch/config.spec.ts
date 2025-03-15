import { GlobalConfig } from '../../../../config/global';
import * as presets from '../../../../config/presets/local';
import { PRESET_DEP_NOT_FOUND } from '../../../../config/presets/util';
import { getOnboardingConfig, getOnboardingConfigContents } from './config';
import { partial } from '~test/util';
import type { RenovateConfig } from '~test/util';

vi.mock('../../../../config/presets/local');

const mockedPresets = vi.mocked(presets);

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
    it('handles finding a preset in the same group level', async () => {
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

    it('handles finding a preset in the same group', async () => {
      config.repository = 'org/group/repo';
      mockedPresets.getPreset.mockImplementation(({ repo }) => {
        if (repo === 'org/group/renovate-config') {
          return Promise.resolve({ enabled: true });
        }
        return Promise.reject(new Error(PRESET_DEP_NOT_FOUND));
      });
      const onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(1);
      expect(onboardingConfig).toEqual({
        $schema: 'https://docs.renovatebot.com/renovate-schema.json',
        extends: ['local>org/group/renovate-config'],
      });
    });

    it('handles finding a preset in a parent group', async () => {
      config.repository = 'org/group/repo';
      mockedPresets.getPreset.mockImplementation(({ repo }) => {
        if (repo === 'org/renovate-config') {
          return Promise.resolve({ enabled: true });
        }
        return Promise.reject(new Error(PRESET_DEP_NOT_FOUND));
      });
      const onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(2);
      expect(onboardingConfig).toEqual({
        $schema: 'https://docs.renovatebot.com/renovate-schema.json',
        extends: ['local>org/renovate-config'],
      });
    });

    it('handles falling back to finding a organization preset', async () => {
      config.repository = 'org/group/repo';
      mockedPresets.getPreset.mockImplementation(({ repo }) => {
        if (repo === 'org/.github') {
          return Promise.resolve({ enabled: true });
        }
        return Promise.reject(new Error(PRESET_DEP_NOT_FOUND));
      });
      const onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(3);
      expect(onboardingConfig).toEqual({
        $schema: 'https://docs.renovatebot.com/renovate-schema.json',
        extends: ['local>org/.github:renovate-config'],
      });
    });

    it('handles not finding any preset', async () => {
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
