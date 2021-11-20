import { MigrationsService } from '../migrations-service';
import { SemanticCommitsMigration } from './semantic-commits-migration';

describe('config/migrations/custom/semantic-commits-migration', () => {
  it('should migrate true to "enabled"', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        semanticCommits: true,
      } as any,
      SemanticCommitsMigration
    );

    expect(migratedConfig.semanticCommits).toBe('enabled');
  });

  it('should migrate false to "disabled"', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        semanticCommits: false,
      } as any,
      SemanticCommitsMigration
    );

    expect(migratedConfig.semanticCommits).toBe('disabled');
  });

  it('should migrate random string to "auto"', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        semanticCommits: 'test',
      } as any,
      SemanticCommitsMigration
    );

    expect(migratedConfig.semanticCommits).toBe('auto');
  });
});
