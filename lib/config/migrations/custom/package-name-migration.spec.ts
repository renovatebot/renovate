import { PackageNameMigration } from './package-name-migration';

describe('config/migrations/custom/package-name-migration', () => {
  it('should migrate value to array', async () => {
    await expect(PackageNameMigration).toMigrate(
      {
        packageName: 'test',
      },
      {
        packageNames: ['test'],
      },
    );
  });
});
