import { GitlabIgnoreApprovalsractMigration } from './gitlab-ignore-approvals-migration';

describe('config/migrations/custom/gitlab-ignore-approvals-migration', () => {
  it('should migrate', () => {
    expect(GitlabIgnoreApprovalsractMigration).toMigrate(
      {
        gitLabIgnoreApprovals: true,
      },
      {
        platformOptions: {
          gitLabIgnoreApprovals: true,
        },
      },
    );
  });

  it('should not migrate', () => {
    expect(GitlabIgnoreApprovalsractMigration).toMigrate(
      {
        platformOptions: {
          gitLabIgnoreApprovals: true,
        },
      },
      {
        platformOptions: {
          gitLabIgnoreApprovals: true,
        },
      },
      false,
    );
  });
});
