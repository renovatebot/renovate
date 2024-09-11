import { AzureWorkItemIdMigration } from './azure-work-item-id-migration';

describe('config/migrations/custom/azure-work-item-id-migration', () => {
  it('should migrate', () => {
    expect(AzureWorkItemIdMigration).toMigrate(
      {
        azureWorkItemId: 101231,
      },
      {
        prOptions: {
          azureWorkItemId: 101231,
        },
      },
    );
  });

  it('should not migrate', () => {
    expect(AzureWorkItemIdMigration).toMigrate(
      {
        prOptions: {
          azureWorkItemId: 101231,
        },
      },
      {
        prOptions: {
          azureWorkItemId: 101231,
        },
      },
      false,
    );
  });
});
