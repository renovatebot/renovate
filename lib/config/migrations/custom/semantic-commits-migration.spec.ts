import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/semantic-commits-migration', () => {
  it('should migrate true to "enabled"', () => {
    const migratedConfig = MigrationsService.run({
      semanticCommits: true,
    } as any);

    expect(migratedConfig.semanticCommits).toBe('enabled');
  });

  it('should migrate false to "disabled"', () => {
    const migratedConfig = MigrationsService.run({
      semanticCommits: false,
    } as any);

    expect(migratedConfig.semanticCommits).toBe('disabled');
  });

  it('should migrate random string to "auto"', () => {
    const migratedConfig = MigrationsService.run({
      semanticCommits: 'test',
    } as any);

    expect(migratedConfig.semanticCommits).toBe('auto');
  });
});
