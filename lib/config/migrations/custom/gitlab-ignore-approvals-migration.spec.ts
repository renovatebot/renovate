import { GitlabIgnoreApprovalsractMigration } from './gitlab-ignore-approvals-migration';

describe('config/migrations/custom/gitlab-ignore-approvals-migration', () => {
  it('should migrate', () => {
    expect(GitlabIgnoreApprovalsractMigration).toMigrate(
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
    expect(GitlabIgnoreApprovalsractMigration).toMigrate(
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
