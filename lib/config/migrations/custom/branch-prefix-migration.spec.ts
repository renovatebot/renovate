import { BranchPrefixMigration } from './branch-prefix-migration';

describe('config/migrations/custom/branch-prefix-migration', () => {
  it('should migrate template', () => {
    expect(BranchPrefixMigration).toMigrate(
      {
        branchPrefix: 'renovate/{{parentDir}}-',
      },
      {
        additionalBranchPrefix: '{{parentDir}}-',
        branchPrefix: 'renovate/',
      },
    );
  });

  it('should ignore string without template', () => {
    expect(BranchPrefixMigration).toMigrate(
      {
        branchPrefix: 'test',
      },
      {
        branchPrefix: 'test',
      },
      false,
    );
  });

  it('should ignore non string without template', () => {
    expect(BranchPrefixMigration).toMigrate(
      {
        branchPrefix: true,
      } as any,
      {
        branchPrefix: true,
      } as any,
      false,
    );
  });
});
