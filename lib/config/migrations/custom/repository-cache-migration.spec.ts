import { RepositoryCacheMigration } from './repository-cache-migration.ts';

describe('config/migrations/custom/repository-cache-migration', () => {
  it('moves the flat options into the repositoryCache object', async () => {
    await expect(RepositoryCacheMigration).toMigrate(
      {
        repositoryCache: 'enabled',
        repositoryCacheType: 's3://bucket',
        repositoryCacheForceLocal: true,
        httpCacheTtlDays: 7,
        prCacheSyncMaxPages: 5,
      },
      {
        repositoryCache: {
          state: 'enabled',
          type: 's3://bucket',
          forceLocal: true,
          httpTtlDays: 7,
          prSyncMaxPages: 5,
        },
      },
    );
  });

  it('migrates a standalone state', async () => {
    await expect(RepositoryCacheMigration).toMigrate(
      { repositoryCache: 'reset' },
      { repositoryCache: { state: 'reset' } },
    );
  });

  it('keeps a state which comes after the flat options', async () => {
    await expect(RepositoryCacheMigration).toMigrate(
      {
        repositoryCacheType: 's3://bucket',
        repositoryCache: 'enabled',
      },
      {
        repositoryCache: { state: 'enabled', type: 's3://bucket' },
      },
    );
  });

  it('migrates the flat options without a state', async () => {
    await expect(RepositoryCacheMigration).toMigrate(
      { repositoryCacheForceLocal: true },
      { repositoryCache: { forceLocal: true } },
    );
  });

  it('prefers values already in the repositoryCache object', async () => {
    await expect(RepositoryCacheMigration).toMigrate(
      {
        repositoryCache: { state: 'enabled', type: 'local' },
        repositoryCacheType: 's3://bucket',
        repositoryCacheForceLocal: true,
      },
      {
        repositoryCache: {
          state: 'enabled',
          type: 'local',
          forceLocal: true,
        },
      },
    );
  });

  it('leaves an invalid repositoryCache and the flat options for validation', async () => {
    await expect(RepositoryCacheMigration).toMigrate(
      {
        repositoryCache: 'invalid',
        repositoryCacheType: 's3://bucket',
      },
      {
        repositoryCache: 'invalid',
        repositoryCacheType: 's3://bucket',
      },
      false,
    );
  });
});
