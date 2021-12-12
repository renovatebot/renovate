import { validateCustomMigration } from '../validator';
import { IgnoreNodeModulesMigration } from './ignore-node-modules-migration';

describe('config/migrations/custom/ignore-node-modules-migration', () => {
  it('should migrate to ignorePaths', () => {
    validateCustomMigration(
      IgnoreNodeModulesMigration,
      {
        ignoreNodeModules: true,
      },
      { ignorePaths: ['node_modules/'] }
    );
  });
});
