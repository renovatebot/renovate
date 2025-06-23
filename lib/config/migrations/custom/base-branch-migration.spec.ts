import { BaseBranchMigration } from './base-branch-migration';

describe('config/migrations/custom/base-branch-migration', () => {
  it('should migrate value to array', () => {
    expect(BaseBranchMigration).toMigrate(
      {
        baseBranch: 'test',
      },
      {
        baseBranches: ['test'],
      },
    );
  });

  it('should migrate array', () => {
    expect(BaseBranchMigration).toMigrate(
      {
        baseBranch: ['test'],
      } as any,
      {
        baseBranches: ['test'],
      },
    );
  });
});
