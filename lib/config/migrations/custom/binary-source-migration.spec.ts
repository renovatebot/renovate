import { MigrationsService } from '../migrations-service';
import { BinarySourceMigration } from './binary-source-migration';

describe('config/migrations/custom/binary-source-migration', () => {
  it('should migrate "auto" to "global"', () => {
    const migratedConfig = MigrationsService.runMigration(
      {
        binarySource: 'auto',
      },
      BinarySourceMigration
    );

    expect(migratedConfig.binarySource).toBe('global');
  });
});
