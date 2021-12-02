import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/ignore-node-modules-migration', () => {
  it('should migrate to ignorePaths', () => {
    const migratedConfig = MigrationsService.run({
      ignoreNodeModules: true,
    });

    expect(migratedConfig.ignorePaths).toEqual(['node_modules/']);
  });
});
