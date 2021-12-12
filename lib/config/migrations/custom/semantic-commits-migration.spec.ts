import { validateCustomMigration } from '../validator';
import { SemanticCommitsMigration } from './semantic-commits-migration';

describe('config/migrations/custom/semantic-commits-migration', () => {
  it('should migrate true to "enabled"', () => {
    validateCustomMigration(
      SemanticCommitsMigration,
      {
        semanticCommits: true,
      } as any,
      { semanticCommits: 'enabled' }
    );
  });

  it('should migrate false to "disabled"', () => {
    validateCustomMigration(
      SemanticCommitsMigration,
      {
        semanticCommits: false,
      } as any,
      { semanticCommits: 'disabled' }
    );
  });

  it('should migrate null to "auto"', () => {
    validateCustomMigration(
      SemanticCommitsMigration,
      {
        semanticCommits: null,
      } as any,
      { semanticCommits: 'auto' }
    );
  });

  it('should migrate random string to "auto"', () => {
    validateCustomMigration(
      SemanticCommitsMigration,
      {
        semanticCommits: 'test',
      } as any,
      { semanticCommits: 'auto' }
    );
  });

  it('should not migrate valid enabled config', () => {
    validateCustomMigration(
      SemanticCommitsMigration,
      {
        semanticCommits: 'enabled',
      } as any,
      { semanticCommits: 'enabled' },
      false
    );
  });

  it('should not migrate valid disabled config', () => {
    validateCustomMigration(
      SemanticCommitsMigration,
      {
        semanticCommits: 'disabled',
      } as any,
      { semanticCommits: 'disabled' },
      false
    );
  });
});
