import { MigrationsService } from './../migrations-service';

describe('config/migrations/custom/semantic-prefix-migration', () => {
  it('should not handle non string value', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      semanticPrefix: 11,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).not.toHaveProperty('semanticPrefix');
  });

  it('if no scope should set it to null', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      semanticPrefix: 'fix: ',
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).not.toHaveProperty('semanticPrefix');
    expect(migratedConfig.semanticCommitType).toBe('fix');
    expect(migratedConfig.semanticCommitScope).toBeNull();
  });

  it('should migrate semantic prefix with no scope', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      semanticPrefix: 'fix',
    });
    expect(isMigrated).toBeTrue();
    expect(migratedConfig).not.toHaveProperty('semanticPrefix');
    expect(migratedConfig.semanticCommitType).toBe('fix');
    expect(migratedConfig.semanticCommitScope).toBeNull();
  });
});
