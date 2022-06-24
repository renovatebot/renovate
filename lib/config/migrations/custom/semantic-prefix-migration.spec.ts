import { SemanticPrefixMigration } from './semantic-prefix-migration';

describe('config/migrations/custom/semantic-prefix-migration', () => {
  it('should work', () => {
    expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: 'fix(deps):',
      } as any,
      { semanticCommitScope: 'deps', semanticCommitType: 'fix' }
    );
  });

  it('should remove non-string values', () => {
    expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: true,
      } as any,
      {}
    );
  });

  it('should migrate prefix with no-scope to null', () => {
    expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: 'fix:',
      } as any,
      { semanticCommitScope: null as never, semanticCommitType: 'fix' }
    );
  });
});
