import { PackagesMigration } from './packages-migration';

describe('config/migrations/custom/packages-migration', () => {
  it('should migrate to package rules', async () => {
    await expect(PackagesMigration).toMigrate(
      {
        packages: [{ matchPackageNames: ['*'] }],
      },
      {
        packageRules: [{ matchPackageNames: ['*'] }],
      },
    );
  });

  it('should concat with existing package rules', async () => {
    await expect(PackagesMigration).toMigrate(
      {
        packages: [{ matchPackageNames: ['*'] }],
        packageRules: [{ matchPackageNames: [] }],
      },
      {
        packageRules: [{ matchPackageNames: [] }, { matchPackageNames: ['*'] }],
      },
    );
  });

  it('should ignore non array value', async () => {
    await expect(PackagesMigration).toMigrate(
      {
        packages: { matchPackageNames: ['*'] },
        packageRules: [{ matchPackageNames: [] }],
      },
      {
        packageRules: [{ matchPackageNames: [] }],
      },
    );
  });
});
