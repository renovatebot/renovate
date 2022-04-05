import { AzureAutoCompleteMigration } from './azure-auto-complete-migration';

describe('config/migrations/custom/azure-auto-complete-migration', () => {
  it('should migrate non undefined value', () => {
    expect(AzureAutoCompleteMigration).toMigrate(
      {
        azureAutoComplete: true,
      },
      {
        platformAutomerge: true,
      }
    );
  });

  it('should just remove undefined value', () => {
    expect(AzureAutoCompleteMigration).toMigrate(
      {
        azureAutoComplete: undefined,
      },
      {}
    );
  });

  it('should override platformAutomerge', () => {
    expect(AzureAutoCompleteMigration).toMigrate(
      {
        azureAutoComplete: true,
        platformAutomerge: false,
      },
      {
        platformAutomerge: true,
      }
    );
  });
});
