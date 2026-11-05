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
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: '3 days',
          }),
        ).resolves.toBeFalse();
      },
    );

    it.each`
      minimumReleaseAge | npmrc                                  | expected
      ${'3 days'}       | ${undefined}                           | ${true}
      ${'0 days'}       | ${undefined}                           | ${false}
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
            minimumReleaseAgePackageManagerSync: true,
            isLockFileMaintenance: true,
            minimumReleaseAge,
            npmrc,
          }),
        ).resolves.toBe(expected);
      },
    );

    it('reads the repository minimumReleaseAge outside lock file maintenance', async () => {
      await expect(
        enforcesMinimumReleaseAge({
          managerData: npmLockManagerData,
          minimumReleaseAgePackageManagerSync: true,
          minimumReleaseAge: '3 days',
          minimumReleaseAgeRepository: '1 day',
          npmrc: 'min-release-age=2\n',
          constraints: { npm: '11.10.0' },
        }),
      ).resolves.toBeTrue();
    });

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
              minimumReleaseAgePackageManagerSync: true,
              isLockFileMaintenance: true,
              minimumReleaseAge: '3 days',
              npmrc,
              constraints: { npm: constraint },
            }),
          ).resolves.toBe(expected);
        },
      );

      it('does not read the package.json in the working tree', async () => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData: npmLockManagerData,
            minimumReleaseAgePackageManagerSync: true,
            isLockFileMaintenance: true,
            minimumReleaseAge: '1 day',
            npmrc,
            extractedConstraints: { npm: '>=10' },
          }),
        ).resolves.toBeFalse();
        expect(fs.readLocalFile).not.toHaveBeenCalled();
      });

      it('uses the extracted npm constraint', async () => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData: npmLockManagerData,
            minimumReleaseAgePackageManagerSync: true,
            isLockFileMaintenance: true,
            npmrc,
            extractedConstraints: { npm: '>=11.10.0' },
          }),
        ).resolves.toBeTrue();
      });

      it('returns false without an npm constraint', async () => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData: npmLockManagerData,
            minimumReleaseAgePackageManagerSync: true,
            isLockFileMaintenance: true,
            npmrc,
          }),
        ).resolves.toBeFalse();
      });

      it('returns false if minimumReleaseAge is longer than min-release-age', async () => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData: npmLockManagerData,
            minimumReleaseAgePackageManagerSync: true,
            isLockFileMaintenance: true,
            minimumReleaseAge: '5 days',
            npmrc,
            constraints: { npm: '11.10.0' },
          }),
        ).resolves.toBeFalse();
      });
    });
  });
});
