import { MigrationsService } from '../migrations-service';
import { AutomergeMinorMigration } from './automerge-minor-migration';

describe('config/migrations/custom/automerge-minor-migration', () => {
  it('should migrate value to object', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automergeMinor: 'some-value',
      },
      AutomergeMinorMigration
    );

    expect(migratedConfig.minor.automerge).toBeTrue();
  });

  it('should add value to existing object', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automergeMinor: 'some-value',
        minor: {
          excludePackageNames: ['test'],
        },
      },
      AutomergeMinorMigration
    );

    expect(migratedConfig.minor).toEqual({
      automerge: true,
      excludePackageNames: ['test'],
    });
  });
});
