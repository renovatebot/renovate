import { BaseBranchMigration } from './base-branch-migration';

describe('config/migrations/custom/base-branch-migration', () => {
  it('should migrate value to array', async () => {
    await expect(BaseBranchMigration).toMigrate(
      {
        baseBranch: 'test',
      },
      {
        baseBranchPatterns: ['test'],
      },
    );
  });

  it('should migrate array', async () => {
    await expect(BaseBranchMigration).toMigrate(
      {
        baseBranch: ['test'],
      } as any,
      {
        baseBranchPatterns: ['test'],
      },
    );
  });

  it('should push to existing bassBranchPatterns', async () => {
    await expect(BaseBranchMigration).toMigrate(
      {
        baseBranch: ['test'],
        baseBranchPatterns: ['base'],
      } as any,
      {
        baseBranchPatterns: ['base', 'test'],
      },
    );
  });
});
