import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/binary-source-migration', () => {
  it('should migrate "auto" to "global"', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      binarySource: 'auto',
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({
      binarySource: 'global',
    });
  });
});
