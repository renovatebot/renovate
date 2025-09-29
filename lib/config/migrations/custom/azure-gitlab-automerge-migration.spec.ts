import { AzureGitLabAutomergeMigration } from './azure-gitlab-automerge-migration';

describe('config/migrations/custom/azure-gitlab-automerge-migration', () => {
  it('should migrate non undefined gitLabAutomerge', async () => {
    await expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        gitLabAutomerge: true,
      },
      {
        platformAutomerge: true,
      },
    );
  });

  it('should just remove undefined gitLabAutomerge', async () => {
    await expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        gitLabAutomerge: undefined,
      },
      {},
    );
  });

  it('should override platformAutomerge when gitLabAutomerge defined', async () => {
    await expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        gitLabAutomerge: true,
        platformAutomerge: false,
      },
      {
        platformAutomerge: true,
      },
    );
  });

  it('should migrate non undefined azureAutoComplete', async () => {
    await expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        azureAutoComplete: true,
      },
      {
        platformAutomerge: true,
      },
    );
  });

  it('should just remove undefined azureAutoComplete', async () => {
    await expect(AzureGitLabAutomergeMigration).toMigrate(
      {
        azureAutoComplete: undefined,
      },
      {},
    );
  });

  it('should override platformAutomerge when azureAutoComplete defined', async () => {
    await expect(AzureGitLabAutomergeMigration).toMigrate(
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
