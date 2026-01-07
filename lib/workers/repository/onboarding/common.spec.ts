import { GlobalConfig } from '../../../config/global';
import { getOnboardingAutoCloseAge } from './common';
import { logger } from '~test/util';

describe('workers/repository/onboarding/common', () => {
  beforeAll(() => {
    GlobalConfig.reset();
  });

  it('returns null if onboardingAutoCloseAge is not set', () => {
    expect(getOnboardingAutoCloseAge(undefined)).toBeNull();
  });

  it('returns onboardingAutoCloseAge if onboardingAutoCloseAgeLimit is not set', () => {
    expect(getOnboardingAutoCloseAge(100)).toBe(100);
  });

  it('returns onboardingAutoCloseAge if it is within onboardingAutoCloseAgeLimit', () => {
    GlobalConfig.set({ onboardingAutoCloseAgeLimit: 200 });
    expect(getOnboardingAutoCloseAge(100)).toBe(100);
  });

  it('returns onboardingAutoCloseAgeLimit if onboardingAutoCloseAge is greater than onboardingAutoCloseAgeLimit', () => {
    GlobalConfig.set({ onboardingAutoCloseAgeLimit: 50 });
    expect(getOnboardingAutoCloseAge(100)).toBe(50);
    expect(logger.logger.warn).toHaveBeenCalledWith(
      {
        onboardingAutoCloseAge: 100,
        onboardingAutoCloseAgeLimit: 50,
      },
      'Re-setting "onboardingAutoCloseAge" value to "onboardingAutoCloseAgeLimit" because it is greater than the allowed limit',
    );
  });
});
