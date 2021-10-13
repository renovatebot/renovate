import type { RenovateConfig } from '../../types';
import { BinarySourceMigration } from './binary-source-migration';

describe('config/migrations/custom/binary-source-migration', () => {
  it('should migrate "auto" to "global"', () => {
    const originalConfig: Partial<RenovateConfig> = {
      binarySource: 'auto',
    };
    const migratedConfig: Partial<RenovateConfig> = {};
    const migration = new BinarySourceMigration(originalConfig, migratedConfig);
    migration.run();

    expect(migratedConfig.binarySource).toBe('global');
  });
});
