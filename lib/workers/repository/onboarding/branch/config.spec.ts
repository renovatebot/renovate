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
  });
  describe('getOnboardingConfig', () => {
    it('handles not being given an owner', async () => {
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(0);
      expect(JSON.parse(onboardingConfig)).toEqual(config.onboardingConfig);
    });
    it('handles finding an organization preset', async () => {
      config.owner = 'own1';
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(1);
    });
    it('handles not finding an organization preset', async () => {
      config.owner = 'own2';
      mockedPresets.getPreset.mockRejectedValue(
        new Error(PRESET_DEP_NOT_FOUND)
      );
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(1);
      expect(JSON.parse(onboardingConfig)).toEqual(config.onboardingConfig);
    });
  });
});
