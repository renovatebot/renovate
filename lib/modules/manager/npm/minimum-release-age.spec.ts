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
      ${{ hasPackageManager: true }}
    `(
      'returns true without a lock file: $managerData',
      async ({ managerData }) => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData,
            minimumReleaseAgePackageManagerSync: true,
            minimumReleaseAge: '3 days',
            packageFile: 'some-dir/package.json',
          }),
        ).resolves.toBeTrue();
      },
    );

    it.each`
      managerData
      ${{ yarnLock: 'some-dir/yarn.lock' }}
      ${{ pnpmLockFile: 'some-dir/pnpm-lock.yaml' }}
      ${{ ...npmLockManagerData, yarnLock: 'some-dir/yarn.lock' }}
      ${{ ...npmLockManagerData, pnpmLockFile: 'some-dir/pnpm-lock.yaml' }}
      ${{ pnpmLockFile: 'some-dir/pnpm-lock.yaml', yarnLock: 'some-dir/yarn.lock' }}
    `(
      'returns false without a single npm or pnpm lock file: $managerData',
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

    it.each`
      npmrcFileName        | expected
      ${'some-dir/.npmrc'} | ${true}
      ${'.npmrc'}          | ${false}
    `(
      'returns $expected for a before in the .npmrc $npmrcFileName',
      async ({ npmrcFileName, expected }) => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData: { ...npmLockManagerData, npmrcFileName },
            minimumReleaseAgePackageManagerSync: true,
            isLockFileMaintenance: true,
            minimumReleaseAge: null,
            npmrc: 'before=2026-06-01T00:00:00.000Z\n',
          }),
        ).resolves.toBe(expected);
      },
    );

    it('returns false without minimumReleaseAgePackageManagerSync', async () => {
      await expect(
        enforcesMinimumReleaseAge({
          managerData: npmLockManagerData,
          minimumReleaseAge: '3 days',
          minimumReleaseAgeRepository: '3 days',
        }),
      ).resolves.toBeFalse();
    });

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

  describe('enforcesMinimumReleaseAge() for pnpm', () => {
    const pnpmLockManagerData: NpmManagerData = {
      pnpmLockFile: 'some-dir/pnpm-lock.yaml',
    };

    it.each`
      constraint     | expected
      ${'10.17.0'}   | ${true}
      ${'^10.17.0'}  | ${true}
      ${'10.16.0'}   | ${false}
      ${'11.0.4'}    | ${true}
      ${'>=11.0.4'}  | ${false}
      ${'^11.28.0'}  | ${true}
      ${'^12.0.0'}   | ${false}
      ${'12.3.0'}    | ${true}
      ${'>=12.3.0'}  | ${true}
      ${'10.15.1'}   | ${false}
      ${'>=10'}      | ${false}
      ${'11.0.3'}    | ${false}
      ${'^11.0.0'}   | ${false}
      ${'>=10.17.0'} | ${false}
      ${'bananas'}   | ${false}
    `(
      'returns $expected for the pnpm constraint $constraint',
      async ({ constraint, expected }) => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData: pnpmLockManagerData,
            minimumReleaseAgePackageManagerSync: true,
            isLockFileMaintenance: true,
            minimumReleaseAge: '3 days',
            constraints: { pnpm: constraint },
          }),
        ).resolves.toBe(expected);
      },
    );

    it.each`
      minimumReleaseAge | workspace                                                         | expected
      ${null}           | ${{ minimumReleaseAge: 1440 }}                                    | ${true}
      ${'0 days'}       | ${{ minimumReleaseAge: 1440 }}                                    | ${true}
      ${null}           | ${undefined}                                                      | ${false}
      ${'bananas'}      | ${{ minimumReleaseAge: 0 }}                                       | ${false}
      ${'3 days'}       | ${{ minimumReleaseAgeStrict: false }}                             | ${false}
      ${null}           | ${{ minimumReleaseAge: 1440, minimumReleaseAgeStrict: false }}    | ${false}
      ${'3 days'}       | ${{ minimumReleaseAgeStrict: true }}                              | ${true}
      ${'3 days'}       | ${{ hasMinimumReleaseAgeExclude: true }}                          | ${false}
      ${null}           | ${{ minimumReleaseAge: 1440, hasMinimumReleaseAgeExclude: true }} | ${false}
    `(
      'returns $expected for minimumReleaseAge=$minimumReleaseAge and workspace=$workspace',
      async ({ minimumReleaseAge, workspace, expected }) => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData: {
              ...pnpmLockManagerData,
              pnpmMinimumReleaseAge: workspace,
            },
            minimumReleaseAgePackageManagerSync: true,
            isLockFileMaintenance: true,
            minimumReleaseAge,
            constraints: { pnpm: '10.17.0' },
          }),
        ).resolves.toBe(expected);
      },
    );

    it('does not read the pnpm-workspace.yaml in the working tree', async () => {
      fs.readLocalFile.mockResolvedValue('minimumReleaseAgeStrict: false\n');

      await expect(
        enforcesMinimumReleaseAge({
          managerData: pnpmLockManagerData,
          minimumReleaseAgePackageManagerSync: true,
          isLockFileMaintenance: true,
          minimumReleaseAge: '3 days',
          constraints: { pnpm: '10.17.0' },
        }),
      ).resolves.toBeTrue();
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it.each`
      pnpm         | npmrcMinimumReleaseAge | expected
      ${'10.17.0'} | ${1440}                | ${true}
      ${'10.17.0'} | ${0}                   | ${false}
      ${'10.17.0'} | ${undefined}           | ${false}
      ${'11.0.4'}  | ${1440}                | ${false}
    `(
      'returns $expected for pnpm $pnpm with the .npmrc minimum-release-age $npmrcMinimumReleaseAge and no minimumReleaseAge',
      async ({ pnpm, npmrcMinimumReleaseAge, expected }) => {
        await expect(
          enforcesMinimumReleaseAge({
            managerData: {
              ...pnpmLockManagerData,
              pnpmMinimumReleaseAge: { npmrcMinimumReleaseAge },
            },
            minimumReleaseAgePackageManagerSync: true,
            isLockFileMaintenance: true,
            constraints: { pnpm },
          }),
        ).resolves.toBe(expected);
      },
    );

    it('reads the pnpm constraint of the lock file for a package file without its own', async () => {
      await expect(
        enforcesMinimumReleaseAge({
          managerData: {
            ...pnpmLockManagerData,
            pnpmMinimumReleaseAge: { pnpmConstraint: '10.17.0' },
          },
          minimumReleaseAgePackageManagerSync: true,
          isLockFileMaintenance: true,
          minimumReleaseAge: '3 days',
          packageFile: 'some-dir/pkgs/a/package.json',
        }),
      ).resolves.toBeTrue();
    });

    it('prefers the configured pnpm constraint over the one of the lock file', async () => {
      await expect(
        enforcesMinimumReleaseAge({
          managerData: {
            ...pnpmLockManagerData,
            pnpmMinimumReleaseAge: { pnpmConstraint: '10.17.0' },
          },
          minimumReleaseAgePackageManagerSync: true,
          isLockFileMaintenance: true,
          minimumReleaseAge: '3 days',
          constraints: { pnpm: '10.16.0' },
        }),
      ).resolves.toBeFalse();
    });

    it('does not derive the pnpm constraint from the package.json in the working tree', async () => {
      fs.readLocalFile.mockResolvedValue(
        JSON.stringify({ packageManager: 'pnpm@11.28.7' }),
      );

      await expect(
        enforcesMinimumReleaseAge({
          managerData: pnpmLockManagerData,
          minimumReleaseAgePackageManagerSync: true,
          isLockFileMaintenance: true,
          minimumReleaseAge: '1 day',
          extractedConstraints: { pnpm: '>=9' },
        }),
      ).resolves.toBeFalse();
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('returns false without a pnpm constraint', async () => {
      await expect(
        enforcesMinimumReleaseAge({
          managerData: pnpmLockManagerData,
          minimumReleaseAgePackageManagerSync: true,
          isLockFileMaintenance: true,
          minimumReleaseAge: '1 day',
        }),
      ).resolves.toBeFalse();
    });
  });
});
