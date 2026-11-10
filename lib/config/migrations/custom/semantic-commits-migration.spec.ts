import { SemanticCommitsMigration } from './semantic-commits-migration.ts';

describe('config/migrations/custom/semantic-commits-migration', () => {
  it('should migrate true to "enabled"', async () => {
    await expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: true,
      },
      { semanticCommits: 'enabled' },
    );
  });

  it('should migrate false to "disabled"', async () => {
    await expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: false,
      },
      { semanticCommits: 'disabled' },
    );
  });

  it('should migrate null to "auto"', async () => {
    await expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: null,
      },
      { semanticCommits: 'auto' },
    );
  });

  it('should migrate random string to "auto"', async () => {
    await expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: 'test',
      },
      { semanticCommits: 'auto' },
    );
  });

  it('should not migrate valid enabled config', async () => {
    await expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: 'enabled',
      },
      { semanticCommits: 'enabled' },
      false,
    );
  });

  it('should not migrate valid disabled config', async () => {
    await expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: 'disabled',
      },
      { semanticCommits: 'disabled' },
      false,
    );
  });
});
