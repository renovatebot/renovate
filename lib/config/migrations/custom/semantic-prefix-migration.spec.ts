import { SemanticPrefixMigration } from './semantic-prefix-migration.ts';

describe('config/migrations/custom/semantic-prefix-migration', () => {
  it('should work', async () => {
    await expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: 'fix(deps): ',
      },
      { semanticCommitType: 'fix', semanticCommitScope: 'deps' },
    );
  });

  it('should remove non-string values', async () => {
    await expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: true,
      },
      {},
    );
  });

  it('should migrate prefix with no-scope to null', async () => {
    await expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: 'fix: ',
      },
      { semanticCommitType: 'fix', semanticCommitScope: null },
    );
  });

  it('works for random string', async () => {
    await expect(SemanticPrefixMigration).toMigrate(
      {
        semanticPrefix: 'test',
      },
      { semanticCommitType: 'test', semanticCommitScope: null },
    );
  });
});
