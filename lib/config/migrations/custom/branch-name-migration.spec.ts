import { BranchNameMigration } from './branch-name-migration';

describe('config/migrations/custom/branch-name-migration', () => {
  it('should replace pattern', () => {
    expect(BranchNameMigration).toMigrate(
      {
        branchName: 'test {{managerBranchPrefix}} test',
      },
      {
        branchName: 'test {{additionalBranchPrefix}} test',
      },
    );
  });

  it('should not replace another string', () => {
    expect(BranchNameMigration).toMigrate(
      {
        branchName: 'test',
      },
      {
        branchName: 'test',
      },
      false,
    );
  });

  it('should not replace non string value', () => {
    expect(BranchNameMigration).toMigrate(
      {
        branchName: true,
      } as any,
      {
        branchName: true,
      } as any,
      false,
    );
  });
});
