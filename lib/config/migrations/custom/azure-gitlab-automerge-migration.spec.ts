import { AzureGitLabAutomergeMigration } from './azure-gitlab-automerge-migration';

describe('config/migrations/custom/azure-gitlab-automerge-migration', () => {
  it('should migrate non undefined gitLabAutomerge', () => {
    expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        gitLabAutomerge: true,
      },
      {
        platformAutomerge: true,
      },
    );
  });

  it('should just remove undefined gitLabAutomerge', () => {
    expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        gitLabAutomerge: undefined,
      },
      {},
    );
  });

  it('should override platformAutomerge when gitLabAutomerge defined', () => {
    expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        gitLabAutomerge: true,
        platformAutomerge: false,
      },
      {
        platformAutomerge: true,
      },
    );
  });

  it('should migrate non undefined azureAutoComplete', () => {
    expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        azureAutoComplete: true,
      },
      {
        platformAutomerge: true,
      },
    );
  });

  it('should just remove undefined azureAutoComplete', () => {
    expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        azureAutoComplete: undefined,
      },
      {},
    );
  });

  it('should override platformAutomerge when azureAutoComplete defined', () => {
    expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        azureAutoComplete: true,
        platformAutomerge: false,
      },
      {
        platformAutomerge: true,
      },
    );
  });
});
