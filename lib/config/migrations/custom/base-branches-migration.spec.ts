import { BaseBranchesMigration } from './base-branches-migration';

describe('config/migrations/custom/base-branches-migration', () => {
  it('should migrate value to array', () => {
    expect(BaseBranchesMigration).toMigrate(
      {
        baseBranches: ['test'],
      },
      {
        baseBranchPatterns: ['test'],
      },
    );
  });

  it('should push to existing bassBranchPatterns', () => {
    expect(BaseBranchesMigration).toMigrate(
      {
        baseBranches: ['test'],
        baseBranchPatterns: ['base'],
      } as any,
      {
        baseBranchPatterns: ['base', 'test'],
      },
    );
  });
});
