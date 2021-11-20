import { MigrationsService } from '../migrations-service';
import { IgnoreNodeModulesMigration } from './ignore-node-modules-migration';

describe('config/migrations/custom/ignore-node-modules-migration', () => {
  it('should migrate to ignorePaths', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        ignoreNodeModules: true,
      },
      IgnoreNodeModulesMigration
    );

    expect(migratedConfig.ignorePaths).toEqual(['node_modules/']);
  });
});
