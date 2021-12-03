import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/semantic-commits-migration', () => {
  it('should migrate true to "enabled"', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      semanticCommits: true,
    } as any);

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({ semanticCommits: 'enabled' });
  });

  it('should migrate false to "disabled"', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      semanticCommits: false,
    } as any);

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({ semanticCommits: 'disabled' });
  });

  it('should migrate null to "auto"', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      semanticCommits: null,
    } as any);

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({ semanticCommits: 'auto' });
  });

  it('should migrate random string to "auto"', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      semanticCommits: 'test',
    } as any);

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({ semanticCommits: 'auto' });
  });

  it('should not migrate valid enabled config', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      semanticCommits: 'enabled',
    });

    expect(isMigrated).toBeFalse();
    expect(migratedConfig).toMatchObject({ semanticCommits: 'enabled' });
  });

  it('should not migrate valid disabled config', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      semanticCommits: 'disabled',
    });

    expect(isMigrated).toBeFalse();
    expect(migratedConfig).toMatchObject({ semanticCommits: 'disabled' });
  });
});
