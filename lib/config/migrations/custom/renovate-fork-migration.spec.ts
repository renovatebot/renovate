import { MigrationsService } from '../migrations-service';
import { RenovateForkMigration } from './renovate-fork-migration';

describe('config/migrations/custom/renovate-fork-migration', () => {
  it('should migrate true', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        renovateFork: true,
      },
      RenovateForkMigration
    );

    expect(migratedConfig).not.toHaveProperty('renovateFork');
    expect(migratedConfig.includeForks).toBeTrue();
  });

  it('should migrate false', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        renovateFork: false,
      },
      RenovateForkMigration
    );

    expect(migratedConfig).not.toHaveProperty('renovateFork');
    expect(migratedConfig.includeForks).toBeFalse();
  });
});
