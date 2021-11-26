import { MigrationsService } from '../migrations-service';
import { SemanticPrefixMigration } from './semantic-prefix-migration';

describe('config/migrations/custom/semantic-prefix-migration', () => {
  it('should not handle non string value', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        semanticPrefix: 11,
      },
      SemanticPrefixMigration
    );

    expect(migratedConfig).not.toHaveProperty('semanticPrefix');
  });

  it('if no scope should set it to null', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        semanticPrefix: 'fix: ',
      },
      SemanticPrefixMigration
    );

    expect(migratedConfig).not.toHaveProperty('semanticPrefix');
    expect(migratedConfig.semanticCommitType).toBe('fix');
    expect(migratedConfig.semanticCommitScope).toBeNull();
  });
});
