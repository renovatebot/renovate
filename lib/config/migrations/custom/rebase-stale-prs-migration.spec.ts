import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/rebase-stale-prs-migration', () => {
  it('should migrate true', () => {
    const migratedConfig = MigrationsService.run({
      rebaseStalePrs: true,
    });

    expect(migratedConfig.rebaseWhen).toBe('behind-base-branch');
  });

  it('should migrate false', () => {
    const migratedConfig = MigrationsService.run({
      rebaseStalePrs: false,
    });

    expect(migratedConfig.rebaseWhen).toBe('conflicted');
  });

  it('should migrate null', () => {
    const migratedConfig = MigrationsService.run({
      rebaseStalePrs: null,
    });

    expect(migratedConfig.rebaseWhen).toBe('auto');
  });
});
