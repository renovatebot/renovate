import { PackagePatternMigration } from './package-pattern-migration.ts';

describe('config/migrations/custom/package-pattern-migration', () => {
  it('should migrate value to array', async () => {
    await expect(PackagePatternMigration).toMigrate(
      {
        packagePattern: 'test',
      },
      {
        packagePatterns: ['test'],
      },
    );
  });
});
