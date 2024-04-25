import { PackagePatternMigration } from './package-pattern-migration';

describe('config/migrations/custom/package-pattern-migration', () => {
  it('should migrate value to array', () => {
    expect(PackagePatternMigration).toMigrate(
      {
        packagePattern: 'test',
      },
      {
        packagePatterns: ['test'],
      },
    );
  });
});
