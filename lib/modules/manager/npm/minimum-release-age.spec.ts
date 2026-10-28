import { fs } from '~test/util.ts';
import { enforcesMinimumReleaseAge } from './minimum-release-age.ts';
import type { NpmManagerData } from './types.ts';

vi.mock('../../../util/fs/index.ts');

const npmLockManagerData: NpmManagerData = {
  npmLock: 'some-dir/package-lock.json',
};

describe('modules/manager/npm/minimum-release-age', () => {
  describe('enforcesMinimumReleaseAge()', () => {
    it.each`
      managerData
      ${undefined}
      ${{}}
      ${{ ...npmLockManagerData, yarnLock: 'some-dir/yarn.lock' }}
      ${{ ...npmLockManagerData, pnpmLockFile: 'some-dir/pnpm-lock.yaml' }}
    `(
      'returns false without an npm lock file: $managerData',
      async ({ managerData }) => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData,
            minimumReleaseAge: '3 days',
          }),
        ).resolves.toBeFalse();
      },
    );

    it.each`
      minimumReleaseAge | npmrc                                  | expected
      ${'3 days'}       | ${undefined}                           | ${true}
      ${'0 days'}       | ${undefined}                           | ${true}
      ${'3 days'}       | ${'before=2026-06-01T00:00:00.000Z\n'} | ${true}
      ${null}           | ${'before=2026-06-01T00:00:00.000Z\n'} | ${true}
      ${null}           | ${undefined}                           | ${false}
      ${'bananas'}      | ${undefined}                           | ${false}
    `(
      'returns $expected with --before for minimumReleaseAge=$minimumReleaseAge and npmrc=$npmrc',
      async ({ minimumReleaseAge, npmrc, expected }) => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData: npmLockManagerData,
            minimumReleaseAge,
            npmrc,
          }),
        ).resolves.toBe(expected);
      },
    );

    describe('with min-release-age in .npmrc', () => {
      const npmrc = 'min-release-age=3\n';

      it.each`
        constraint     | expected
        ${'11.10.0'}   | ${true}
        ${'>=11.10.0'} | ${true}
        ${'^11.12.0'}  | ${true}
        ${'11.9.0'}    | ${false}
        ${'>=10'}      | ${false}
        ${'^11'}       | ${false}
        ${'bananas'}   | ${false}
      `(
        'returns $expected for the npm constraint $constraint',
        async ({ constraint, expected }) => {
          await expect(
            enforcesMinimumReleaseAge({
              managerData: npmLockManagerData,
              minimumReleaseAge: '3 days',
              npmrc,
              constraints: { npm: constraint },
            }),
          ).resolves.toBe(expected);
        },
      );

      it('derives the npm constraint from package.json', async () => {
        fs.readLocalFile.mockResolvedValueOnce(
          JSON.stringify({ packageManager: 'npm@11.12.0' }),
        );

        await expect(
          enforcesMinimumReleaseAge({
            managerData: npmLockManagerData,
            minimumReleaseAge: '1 day',
            npmrc,
            extractedConstraints: { npm: '>=10' },
          }),
        ).resolves.toBeTrue();
        expect(fs.readLocalFile).toHaveBeenCalledWith(
          'some-dir/package.json',
          'utf8',
        );
      });

      it('falls back to the extracted npm constraint', async () => {
        fs.readLocalFile.mockResolvedValueOnce('{}');

        await expect(
          enforcesMinimumReleaseAge({
            managerData: npmLockManagerData,
            npmrc,
            extractedConstraints: { npm: '>=11.10.0' },
          }),
        ).resolves.toBeTrue();
      });

      it('returns false without an npm constraint', async () => {
        fs.readLocalFile.mockResolvedValueOnce('{}');

        await expect(
          enforcesMinimumReleaseAge({
            managerData: npmLockManagerData,
            npmrc,
          }),
        ).resolves.toBeFalse();
      });

      it('returns false if minimumReleaseAge is longer than min-release-age', async () => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData: npmLockManagerData,
            minimumReleaseAge: '5 days',
            npmrc,
            constraints: { npm: '11.10.0' },
          }),
        ).resolves.toBeFalse();
      });
    });
  });
});
