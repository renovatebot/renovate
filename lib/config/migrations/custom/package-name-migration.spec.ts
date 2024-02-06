import { PackageNameMigration } from './package-name-migration';

describe('config/migrations/custom/package-name-migration', () => {
  it('should migrate value to array', () => {
    expect(PackageNameMigration).toMigrate(
      {
        packageName: 'test',
      },
      {
        packageNames: ['test'],
      },
    );
  });
});
