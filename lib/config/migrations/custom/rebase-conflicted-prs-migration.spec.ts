import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/rebase-conflicted-prs-migration', () => {
  it('should migrate false', () => {
    const migratedConfig = MigrationsService.run({
      rebaseConflictedPrs: false,
    });

    expect(migratedConfig.rebaseWhen).toBe('never');
  });
});
