import { TrustLevelMigration } from './trust-level-migration.ts';

describe('config/migrations/custom/trust-level-migration', () => {
  it('should handle hight level', async () => {
    await expect(TrustLevelMigration).toMigrate(
      {
        trustLevel: 'high',
      },
      {
        allowCustomCrateGitRegistries: true,
        allowScripts: true,
        exposeAllEnv: true,
      },
    );
  });

  it('should not rewrite provided properties', async () => {
    await expect(TrustLevelMigration).toMigrate(
      {
        allowCustomCrateGitRegistries: false,
        allowScripts: false,
        exposeAllEnv: false,
        trustLevel: 'high',
      },
      {
        allowCustomCrateGitRegistries: false,
        allowScripts: false,
        exposeAllEnv: false,
      },
    );
  });
});
