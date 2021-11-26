import { MigrationsService } from '../migrations-service';
import { AutomergePatchMigration } from './automerge-patch-migration';

describe('config/migrations/custom/automerge-patch-migration', () => {
  it('should migrate value to object', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automergePatch: 'some-value',
      },
      AutomergePatchMigration
    );

    expect(migratedConfig.patch.automerge).toBeTrue();
  });

  it('should add value to existing object', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automergePatch: 'some-value',
        patch: {
          excludePackageNames: ['test'],
        },
      },
      AutomergePatchMigration
    );

    expect(migratedConfig.patch).toEqual({
      automerge: true,
      excludePackageNames: ['test'],
    });
  });
});
