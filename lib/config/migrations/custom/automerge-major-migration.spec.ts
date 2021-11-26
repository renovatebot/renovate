import { MigrationsService } from '../migrations-service';
import { AutomergeMajorMigration } from './automerge-major-migration';

describe('config/migrations/custom/automerge-major-migration', () => {
  it('should migrate value to object', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automergeMajor: 'some-value',
      },
      AutomergeMajorMigration
    );

    expect(migratedConfig.major.automerge).toBeTrue();
  });

  it('should add value to existing object', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automergeMajor: 'some-value',
        major: {
          excludePackageNames: ['test'],
        },
      },
      AutomergeMajorMigration
    );

    expect(migratedConfig.major).toEqual({
      automerge: true,
      excludePackageNames: ['test'],
    });
  });
});
