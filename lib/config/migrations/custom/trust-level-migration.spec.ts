import { TrustLevelMigration } from './trust-level-migration';

describe('config/migrations/custom/trust-level-migration', () => {
  it('should handle hight level', () => {
    expect(TrustLevelMigration).toMigrate(
      {
        trustLevel: 'high',
      },
      {
        allowCustomCrateRegistries: true,
        allowScripts: true,
        exposeAllEnv: true,
      },
    );
  });

  it('should not rewrite provided properties', () => {
    expect(TrustLevelMigration).toMigrate(
      {
        allowCustomCrateRegistries: false,
        allowScripts: false,
        exposeAllEnv: false,
        trustLevel: 'high',
      },
      {
        allowCustomCrateRegistries: false,
        allowScripts: false,
        exposeAllEnv: false,
      },
    );
  });
});
