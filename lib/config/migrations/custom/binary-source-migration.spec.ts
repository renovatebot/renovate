import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/binary-source-migration', () => {
  it('should migrate "auto" to "global"', () => {
    const migratedConfig = MigrationsService.run({
      binarySource: 'auto',
    });

    expect(migratedConfig.binarySource).toBe('global');
  });
});
