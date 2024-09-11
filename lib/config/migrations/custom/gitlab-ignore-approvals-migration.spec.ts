import { GitlabIgnoreApprovalsMigration } from './gitlab-ignore-approvals-migration';

describe('config/migrations/custom/gitlab-ignore-approvals-migration', () => {
  it('should migrate', () => {
    expect(GitlabIgnoreApprovalsMigration).toMigrate(
      {
        gitLabIgnoreApprovals: true,
      },
      {
        prOptions: {
          gitLabIgnoreApprovals: true,
        },
      },
    );
  });

  it('should not migrate', () => {
    expect(GitlabIgnoreApprovalsMigration).toMigrate(
      {
        prOptions: {
          gitLabIgnoreApprovals: true,
        },
      },
      {
        prOptions: {
          gitLabIgnoreApprovals: true,
        },
      },
      false,
    );
  });
});
