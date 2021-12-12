import { getCustomMigrationValidator } from '../validator';
import { SemanticCommitsMigration } from './semantic-commits-migration';

describe('config/migrations/custom/semantic-commits-migration', () => {
  const validate = getCustomMigrationValidator(SemanticCommitsMigration);

  it('should migrate true to "enabled"', () => {
    validate(
      {
        semanticCommits: true,
      } as any,
      { semanticCommits: 'enabled' }
    );
  });

  it('should migrate false to "disabled"', () => {
    validate(
      {
        semanticCommits: false,
      } as any,
      { semanticCommits: 'disabled' }
    );
  });

  it('should migrate null to "auto"', () => {
    validate(
      {
        semanticCommits: null,
      } as any,
      { semanticCommits: 'auto' }
    );
  });

  it('should migrate random string to "auto"', () => {
    validate(
      {
        semanticCommits: 'test',
      } as any,
      { semanticCommits: 'auto' }
    );
  });

  it('should not migrate valid enabled config', () => {
    validate(
      {
        semanticCommits: 'enabled',
      } as any,
      { semanticCommits: 'enabled' },
      false
    );
  });

  it('should not migrate valid disabled config', () => {
    validate(
      {
        semanticCommits: 'disabled',
      } as any,
      { semanticCommits: 'disabled' },
      false
    );
  });
});
