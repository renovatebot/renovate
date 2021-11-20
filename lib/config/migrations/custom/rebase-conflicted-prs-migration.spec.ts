import { MigrationsService } from '../migrations-service';
import { RebaseConflictedPrs } from './rebase-conflicted-prs-migration';

describe('config/migrations/custom/rebase-conflicted-prs-migration', () => {
  it('should migrate false', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        rebaseConflictedPrs: false,
      },
      RebaseConflictedPrs
    );

    expect(migratedConfig).not.toHaveProperty('rebaseConflictedPrs');
    expect(migratedConfig.rebaseWhen).toBe('never');
  });
});
