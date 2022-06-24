import { SemanticPrefixMigration } from './semantic-prefix-migration';

describe('config/migrations/custom/semantic-prefix-migration', () => {
  it('should migrate true to "enabled"', () => {
    expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: 'fix(deps):',
      } as any,
      { semanticCommitScope: 'deps', semanticCommitType: 'fix' }
    );
  });

  it('should migrate non-string to emoty', () => {
    expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: true,
      } as any,
      {}
    );
  });

  it('should migrate no scoped to null', () => {
    expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: 'fix:',
      } as any,
      { semanticCommitScope: null as never, semanticCommitType: 'fix' }
    );
  });
});
