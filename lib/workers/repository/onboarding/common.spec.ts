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

  it('returns inherited onboardingAutoCloseAge if global onboardingAutoCloseAge is not set', () => {
    expect(getOnboardingAutoCloseAge(100)).toBe(100);
  });

  it('returns global onboardingAutoCloseAge if inherited onboardingAutoCloseAge is not set ', () => {
    GlobalConfig.set({ onboardingAutoCloseAge: 100 });
    expect(getOnboardingAutoCloseAge(undefined)).toBe(100);
  });

  it('returns global onboardingAutoCloseAge if inherited onboardingAutoCloseAge is set but is greater', () => {
    GlobalConfig.set({ onboardingAutoCloseAge: 50 });
    expect(getOnboardingAutoCloseAge(100)).toBe(50);
    expect(logger.logger.warn).toHaveBeenCalledWith(
      {
        inheritedOnboardingAutoCloseAge: 100,
        globalOnboardingAutoCloseAge: 50,
      },
      'Re-setting "onboardingAutoCloseAge" value as it crosses the global limit',
    );
  });

  it('returns inherited onboardingAutoCloseAge if it is <= global onboardingAutoCloseAge', () => {
    GlobalConfig.set({ onboardingAutoCloseAge: 50 });
    expect(getOnboardingAutoCloseAge(20)).toBe(20);
  });
});
