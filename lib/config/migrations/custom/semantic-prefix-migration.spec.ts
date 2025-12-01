import { SemanticPrefixMigration } from './semantic-prefix-migration';

describe('config/migrations/custom/semantic-prefix-migration', () => {
  it('should work', async () => {
    await expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: 'fix(deps): ',
      } as any,
      { semanticCommitType: 'fix', semanticCommitScope: 'deps' },
    );
  });

  it('should remove non-string values', async () => {
    await expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: true,
      } as any,
      {},
    );
  });

  it('should migrate prefix with no-scope to null', async () => {
    await expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: 'fix: ',
      } as any,
      { semanticCommitType: 'fix', semanticCommitScope: null },
    );
  });

  it('works for random string', async () => {
    await expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: 'test',
      } as any,
      { semanticCommitType: 'test', semanticCommitScope: null },
    );
  });
});
