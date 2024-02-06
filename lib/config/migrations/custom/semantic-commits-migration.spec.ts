import { SemanticCommitsMigration } from './semantic-commits-migration';

describe('config/migrations/custom/semantic-commits-migration', () => {
  it('should migrate true to "enabled"', () => {
    expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: true,
      } as any,
      { semanticCommits: 'enabled' },
    );
  });

  it('should migrate false to "disabled"', () => {
    expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: false,
      } as any,
      { semanticCommits: 'disabled' },
    );
  });

  it('should migrate null to "auto"', () => {
    expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: null,
      } as any,
      { semanticCommits: 'auto' },
    );
  });

  it('should migrate random string to "auto"', () => {
    expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: 'test',
      } as any,
      { semanticCommits: 'auto' },
    );
  });

  it('should not migrate valid enabled config', () => {
    expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: 'enabled',
      } as any,
      { semanticCommits: 'enabled' },
      false,
    );
  });

  it('should not migrate valid disabled config', () => {
    expect(SemanticCommitsMigration).toMigrate(
      {
        semanticCommits: 'disabled',
      } as any,
      { semanticCommits: 'disabled' },
      false,
    );
  });
});
