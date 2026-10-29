import {
  enforcesMinimumReleaseAge,
  getGlobalMinPublishAge,
} from './minimum-release-age.ts';

describe('modules/manager/cargo/minimum-release-age', () => {
  describe('getGlobalMinPublishAge()', () => {
    it.each`
      age           | expected
      ${'3 days'}   | ${'3 days'}
      ${'2 weeks'}  | ${'2 weeks'}
      ${'1 months'} | ${'1 months'}
      ${'0'}        | ${undefined}
      ${''}         | ${undefined}
      ${'invalid'}  | ${undefined}
      ${undefined}  | ${undefined}
    `('returns $expected for $age', ({ age, expected }) => {
      expect(
        getGlobalMinPublishAge({
          registry: { 'global-min-publish-age': age },
        }),
      ).toBe(expected);
    });

    it('returns undefined without a registry section', () => {
      expect(getGlobalMinPublishAge({})).toBeUndefined();
    });
  });

  describe('enforcesMinimumReleaseAge()', () => {
    beforeEach(() => {
      vi.stubEnv('RENOVATE_X_CARGO_MIN_PUBLISH_AGE', 'true');
    });

    it('returns false without RENOVATE_X_CARGO_MIN_PUBLISH_AGE', async () => {
      vi.stubEnv('RENOVATE_X_CARGO_MIN_PUBLISH_AGE', undefined);

      await expect(
        enforcesMinimumReleaseAge({ constraints: { rust: '1.100.0' } }),
      ).resolves.toBe(false);
    });

    it.each`
      constraint              | expected
      ${'1.100.0'}            | ${true}
      ${'1.100'}              | ${true}
      ${'1.101.1'}            | ${true}
      ${'>=1.100'}            | ${true}
      ${'1.99.0'}             | ${false}
      ${'1.100.0-beta.1'}     | ${false}
      ${'stable'}             | ${false}
      ${'nightly-2026-11-01'} | ${false}
      ${'invalid'}            | ${false}
      ${undefined}            | ${false}
    `(
      'returns $expected for the configured Rust constraint $constraint',
      async ({ constraint, expected }) => {
        await expect(
          enforcesMinimumReleaseAge({ constraints: { rust: constraint } }),
        ).resolves.toBe(expected);
      },
    );

    it('uses the extracted Rust constraint', async () => {
      await expect(
        enforcesMinimumReleaseAge({ extractedConstraints: { rust: '1.100' } }),
      ).resolves.toBe(true);
    });

    it('prefers the configured Rust constraint', async () => {
      await expect(
        enforcesMinimumReleaseAge({
          constraints: { rust: '1.99.0' },
          extractedConstraints: { rust: '1.100.0' },
        }),
      ).resolves.toBe(false);
    });
  });
});
