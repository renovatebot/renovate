import { PackagesMigration } from './packages-migration';

describe('config/migrations/custom/packages-migration', () => {
  it('should migrate to package rules', () => {
    expect(PackagesMigration).toMigrate(
      {
        packages: [{ matchPackagePatterns: ['*'] }],
      },
      {
        packageRules: [{ matchPackagePatterns: ['*'] }],
      },
    );
  });

  it('should concat with existing package rules', () => {
    expect(PackagesMigration).toMigrate(
      {
        packages: [{ matchPackagePatterns: ['*'] }],
        packageRules: [{ matchPackageNames: [] }],
      },
      {
        packageRules: [
          { matchPackageNames: [] },
          { matchPackagePatterns: ['*'] },
        ],
      },
    );
  });

  it('should ignore non array value', () => {
    expect(PackagesMigration).toMigrate(
      {
        packages: { matchPackagePatterns: ['*'] },
        packageRules: [{ matchPackageNames: [] }],
      },
      {
        packageRules: [{ matchPackageNames: [] }],
      },
    );
  });
});
