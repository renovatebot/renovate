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
});
