import { GitLabAutomergeMigration } from './gitlab-automerge-migration';

describe('config/migrations/custom/gitlab-automerge-migration', () => {
  it('should migrate non undefined value', () => {
    expect(GitLabAutomergeMigration).toMigrate(
      {
        gitLabAutomerge: true,
      },
      {
        platformAutomerge: true,
      }
    );
  });

  it('should just remove undefined value', () => {
    expect(GitLabAutomergeMigration).toMigrate(
      {
        gitLabAutomerge: undefined,
      },
      {}
    );
  });

  it('should override platformAutomerge', () => {
    expect(GitLabAutomergeMigration).toMigrate(
      {
        gitLabAutomerge: true,
        platformAutomerge: false,
      },
      {
        platformAutomerge: true,
      }
    );
  });
});
