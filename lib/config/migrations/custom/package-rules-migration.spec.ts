import { PackageRulesMigration } from './package-rules-migration';

describe('config/migrations/custom/package-rules-migration', () => {
  it('should migrate plain object to array', () => {
    expect(PackageRulesMigration).toMigrate(
      {
        packageRules: { test: 'test ' },
      } as any,
      {
        packageRules: [{ test: 'test ' }],
      }
    );
  });

  it('should not migrate non object value', () => {
    expect(PackageRulesMigration).toMigrate(
      {
        packageRules: null,
      } as any,
      {
        packageRules: null,
      },
      false
    );
  });
});
