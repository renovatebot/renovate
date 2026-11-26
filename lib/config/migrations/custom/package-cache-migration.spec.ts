import { PackageCacheMigration } from './package-cache-migration.ts';

describe('config/migrations/custom/package-cache-migration', () => {
  it('moves the flat options into the packageCache object', async () => {
    await expect(PackageCacheMigration).toMigrate(
      {
        cacheHardTtlMinutes: 60,
        cachePrivatePackages: true,
        cacheTtlOverride: { 'datasource-npm': 30 },
        presetCachePersistence: true,
        redisPrefix: 'prefix',
        redisUrl: 'redis://localhost:6379',
      },
      {
        packageCache: {
          hardTtlMinutes: 60,
          privatePackages: true,
          ttlOverride: { 'datasource-npm': 30 },
          presetPersistence: true,
          redisPrefix: 'prefix',
          redisUrl: 'redis://localhost:6379',
        },
      },
    );
  });

  it('prefers values already in the packageCache object', async () => {
    await expect(PackageCacheMigration).toMigrate(
      {
        packageCache: { redisUrl: 'new' },
        redisUrl: 'old',
        redisPrefix: 'prefix',
      },
      {
        packageCache: { redisUrl: 'new', redisPrefix: 'prefix' },
      },
    );
  });

  it('leaves an invalid packageCache and the flat options for validation', async () => {
    await expect(PackageCacheMigration).toMigrate(
      {
        packageCache: 'yes',
        redisUrl: 'url',
      },
      {
        packageCache: 'yes',
        redisUrl: 'url',
      },
      false,
    );
  });
});
