import { getCustomMigrationValidator } from '../validator';
import { TrustLevelMigration } from './trust-level-migration';

describe('config/migrations/custom/trust-level-migration', () => {
  const validate = getCustomMigrationValidator(TrustLevelMigration);

  it('should handle hight level', () => {
    validate(
      {
        trustLevel: 'high',
      },
      {
        allowCustomCrateRegistries: true,
        allowScripts: true,
        exposeAllEnv: true,
      }
    );
  });

  it('should not rewrite provided properties', () => {
    validate(
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
      }
    );
  });
});
