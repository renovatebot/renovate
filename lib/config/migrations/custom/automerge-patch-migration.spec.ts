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
});
