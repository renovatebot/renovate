import { RenovateConfig, getConfig } from '../../../../../test/util';
import * as presets from '../../../../config/presets/local';
import { PRESET_DEP_NOT_FOUND } from '../../../../config/presets/util';
import * as semantic from '../../init/semantic';
import { getOnboardingConfig } from './config';

jest.mock('../../../../config/presets/local');
jest.mock('../../init/semantic');

const mockedPresets = presets as jest.Mocked<typeof presets>;
const mockedSemantic = semantic as jest.Mocked<typeof semantic>;

describe('workers/repository/onboarding/branch', () => {
  let config: RenovateConfig;
  let onboardingConfig: string;
  beforeEach(() => {
    jest.clearAllMocks();
    config = getConfig();
    config.platform = 'github';
    config.repository = 'some/repo';
    mockedSemantic.detectSemanticCommits.mockResolvedValue('disabled');
  });
  describe('getOnboardingConfig', () => {
    it('handles finding an organization preset', async () => {
      mockedPresets.getPreset.mockResolvedValueOnce({ enabled: true });
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(1);
      expect(JSON.parse(onboardingConfig).extends[0]).toEqual(
        'local>some/renovate-config'
      );
    });
    it('handles finding an organization dot platform preset', async () => {
      mockedPresets.getPreset.mockRejectedValueOnce(
        new Error(PRESET_DEP_NOT_FOUND)
      );
      mockedPresets.getPreset.mockResolvedValueOnce({ enabled: true });
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(2);
      expect(JSON.parse(onboardingConfig).extends[0]).toEqual(
        'local>some/.github:renovate-config'
      );
    });
    it('handles not finding an organization preset', async () => {
      mockedPresets.getPreset.mockRejectedValue(
        new Error(PRESET_DEP_NOT_FOUND)
      );
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(2);
      expect(JSON.parse(onboardingConfig)).toEqual(config.onboardingConfig);
    });
    it('ignores an unknown error', async () => {
      mockedPresets.getPreset.mockRejectedValue(
        new Error('unknown error for test')
      );
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(2);
      expect(JSON.parse(onboardingConfig)).toEqual(config.onboardingConfig);
    });
    it('ignores unsupported platform', async () => {
      mockedPresets.getPreset.mockRejectedValue(
        new Error(`Unsupported platform 'dummy' for local preset.`)
      );
      onboardingConfig = await getOnboardingConfig(config);
      expect(mockedPresets.getPreset).toHaveBeenCalledTimes(2);
      expect(JSON.parse(onboardingConfig)).toEqual(config.onboardingConfig);
    });
    it('handles semanticCommits detection', async () => {
      mockedSemantic.detectSemanticCommits.mockReset();
      mockedSemantic.detectSemanticCommits.mockResolvedValueOnce('enabled');
      onboardingConfig = await getOnboardingConfig(config);
      expect(JSON.parse(onboardingConfig).semanticCommits).toEqual('enabled');
    });
    it('does not set semanticCommits if not detected', async () => {
      onboardingConfig = await getOnboardingConfig(config);
      expect(JSON.parse(onboardingConfig).semanticCommits).toBeUndefined();
    });
    it('does not set semanticCommits if already enabled', async () => {
      onboardingConfig = await getOnboardingConfig({
        ...config,
        semanticCommits: 'enabled',
      });
      expect(JSON.parse(onboardingConfig).semanticCommits).toBeUndefined();
    });
    it('does not set semanticCommits if already disabled', async () => {
      onboardingConfig = await getOnboardingConfig({
        ...config,
        semanticCommits: 'disabled',
      });
      expect(JSON.parse(onboardingConfig).semanticCommits).toBeUndefined();
    });
    it('does not set semanticCommits if already set to auto', async () => {
      onboardingConfig = await getOnboardingConfig({
        ...config,
        semanticCommits: 'auto',
      });
      expect(JSON.parse(onboardingConfig).semanticCommits).toBeUndefined();
    });
  });
});
