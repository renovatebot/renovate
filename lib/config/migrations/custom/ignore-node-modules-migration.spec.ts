import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/ignore-node-modules-migration', () => {
  it('should migrate to ignorePaths', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      ignoreNodeModules: true,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({ ignorePaths: ['node_modules/'] });
  });
});
