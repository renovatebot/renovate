import type { RenovateConfig } from '../../types';
import { IgnoreNodeModulesMigration } from './ignore-node-modules-migration';

describe('config/migrations/custom/ignore-node-modules-migration', () => {
  it('should migrate to ignorePaths', () => {
    const originalConfig: Partial<RenovateConfig> = {
      ignoreNodeModules: true,
    };
    const migratedConfig: Partial<RenovateConfig> = {};
    const migration = new IgnoreNodeModulesMigration(
      originalConfig,
      migratedConfig
    );
    migration.run();

    expect(migratedConfig.ignorePaths).toEqual(['node_modules/']);
  });
});
