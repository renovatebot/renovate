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
});
