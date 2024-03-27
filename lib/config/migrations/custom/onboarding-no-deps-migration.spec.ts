import { OnboardingNoDepsMigration } from './onboarding-no-deps-migration';

describe('config/migrations/custom/onboarding-no-deps-migration', () => {
  it('should migrate false', () => {
    expect(OnboardingNoDepsMigration).toMigrate(
      {
        onboardingNoDeps: false as never,
      },
      {
        onboardingNoDeps: 'disabled',
      },
    );
  });

  it('should migrate true', () => {
    expect(OnboardingNoDepsMigration).toMigrate(
      {
        onboardingNoDeps: true as never,
      },
      { onboardingNoDeps: 'enabled' },
    );
  });
});
