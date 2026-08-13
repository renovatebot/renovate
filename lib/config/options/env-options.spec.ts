import { getEnvOptionsMap } from './env-options.ts';

describe('config/options/env-options', () => {
  const map = getEnvOptionsMap();

  it('maps camelCase config names to RENOVATE_SCREAMING_SNAKE_CASE env vars', () => {
    expect(map.RENOVATE_PLATFORM).toEqual(
      expect.objectContaining({
        configName: 'platform',
      }),
    );
  });

  it('maps multi-word config names correctly', () => {
    expect(map.RENOVATE_BASE_BRANCH_PATTERNS).toEqual(
      expect.objectContaining({
        configName: 'baseBranchPatterns',
      }),
    );
  });

  it('marks globalOnly options correctly', () => {
    expect(map.RENOVATE_DRY_RUN).toEqual(
      expect.objectContaining({
        configName: 'dryRun',
        globalOnly: true,
      }),
    );
  });

  it('marks non-globalOnly options correctly', () => {
    expect(map.RENOVATE_ENABLED).toEqual(
      expect.objectContaining({
        configName: 'enabled',
        globalOnly: false,
      }),
    );
  });

  it('marks inheritConfigSupport options correctly', () => {
    expect(map.RENOVATE_ONBOARDING_BRANCH).toEqual(
      expect.objectContaining({
        configName: 'onboardingBranch',
        inheritConfigSupport: true,
      }),
    );
  });

  it('excludes options with env: false', () => {
    // bumpVersions has env: false
    expect(map.RENOVATE_BUMP_VERSIONS).toBeUndefined();
  });

  it('includes the option type', () => {
    expect(map.RENOVATE_DRY_RUN).toEqual(
      expect.objectContaining({
        type: 'string',
      }),
    );
    expect(map.RENOVATE_ENABLED).toEqual(
      expect.objectContaining({
        type: 'boolean',
      }),
    );
  });
});
