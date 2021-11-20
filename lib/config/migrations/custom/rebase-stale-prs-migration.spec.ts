import { MigrationsService } from '../migrations-service';
import { RebaseStalePrsMigration } from './rebase-stale-prs-migration';

describe('config/migrations/custom/rebase-stale-prs-migration', () => {
  it('should migrate true', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        rebaseStalePrs: true,
      },
      RebaseStalePrsMigration
    );

    expect(migratedConfig).not.toHaveProperty('rebaseStalePrs');
    expect(migratedConfig.rebaseWhen).toBe('behind-base-branch');
  });

  it('should migrate false', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        rebaseStalePrs: false,
      },
      RebaseStalePrsMigration
    );

    expect(migratedConfig).not.toHaveProperty('rebaseStalePrs');
    expect(migratedConfig.rebaseWhen).toBe('conflicted');
  });

  it('should migrate null', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        rebaseStalePrs: null,
      },
      RebaseStalePrsMigration
    );

    expect(migratedConfig).not.toHaveProperty('rebaseStalePrs');
    expect(migratedConfig.rebaseWhen).toBe('auto');
  });
});
