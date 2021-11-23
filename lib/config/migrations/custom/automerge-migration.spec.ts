import { MigrationsService } from '../migrations-service';
import { AutomergeMigration } from './automerge-migration';

describe('config/migrations/custom/automerge-migration', () => {
  it('should migrate none', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automerge: 'none',
      } as any,
      AutomergeMigration
    );

    expect(migratedConfig.automerge).toBeFalse();
  });

  it('should migrate patch', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automerge: 'patch',
      } as any,
      AutomergeMigration
    );

    expect(migratedConfig).not.toHaveProperty('automerge');
    expect(migratedConfig.patch.automerge).toBeTrue();
    expect(migratedConfig.minor.automerge).toBeFalse();
    expect(migratedConfig.major.automerge).toBeFalse();
  });

  it('should migrate minor', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automerge: 'minor',
      } as any,
      AutomergeMigration
    );

    expect(migratedConfig).not.toHaveProperty('automerge');
    expect(migratedConfig.minor.automerge).toBeTrue();
    expect(migratedConfig.major.automerge).toBeFalse();
  });

  it('should migrate any', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        automerge: 'any',
      } as any,
      AutomergeMigration
    );

    expect(migratedConfig.automerge).toBeTrue();
  });
});
