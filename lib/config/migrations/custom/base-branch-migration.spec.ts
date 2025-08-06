import { BaseBranchMigration } from './base-branch-migration';

describe('config/migrations/custom/base-branch-migration', () => {
  it('should migrate value to array', () => {
    expect(BaseBranchMigration).toMigrate(
      {
        baseBranch: 'test',
      },
      {
        baseBranchPatterns: ['test'],
      },
    );
  });

  it('should migrate array', () => {
    expect(BaseBranchMigration).toMigrate(
      {
        baseBranch: ['test'],
      } as any,
      {
        baseBranchPatterns: ['test'],
      },
    );
  });

  it('should push to existing bassBranchPatterns', () => {
    expect(BaseBranchMigration).toMigrate(
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
