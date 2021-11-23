import { MigrationsService } from '../migrations-service';
import { AutomergeTypeMigration } from './automerge-type-migration';

describe('config/migrations/custom/automerge-type-migration', () => {
  it('should migrate string like "branch-" to "branch"', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automergeType: 'branch-test',
      },
      AutomergeTypeMigration
    );

    expect(migratedConfig.automergeType).toBe('branch');
  });
});
