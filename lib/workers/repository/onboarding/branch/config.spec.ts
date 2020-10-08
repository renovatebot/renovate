import { RenovateConfig, getConfig } from '../../../../../test/util';
import * as presets from '../../../../config/presets';
import { PRESET_DEP_NOT_FOUND } from '../../../../config/presets/util';
import { getOnboardingConfig } from './config';

jest.mock('../../../../config/presets');

const mockedPresets = presets as jest.Mocked<typeof presets>;

describe('workers/repository/onboarding/branch', () => {
  let config: RenovateConfig;
  let onboardingConfig: string;
  beforeEach(() => {
    jest.clearAllMocks();
    config = getConfig();
    config.repository = 'some/repo';
  });
  describe('getOnboardingConfig', () => {
    it('handles finding an organization preset', async () => {
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(1);
      expect(JSON.parse(onboardingConfig).extends[0]).toEqual(
        'local>some/renovate-config'
      );
    });
    it('handles not finding an organization preset', async () => {
      mockedPresets.getPreset.mockRejectedValue(
        new Error(PRESET_DEP_NOT_FOUND)
      );
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(1);
      expect(JSON.parse(onboardingConfig)).toEqual(config.onboardingConfig);
    });
    it('ignores an unknown error', async () => {
      mockedPresets.getPreset.mockRejectedValue(
        new Error('unknown error for test')
      );
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(1);
      expect(JSON.parse(onboardingConfig)).toEqual(config.onboardingConfig);
    });
  });
});
