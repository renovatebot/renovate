import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/unpublish-safe-migration', () => {
  it('should migrate true', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      unpublishSafe: true,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({
      extends: ['npm:unpublishSafe'],
    });
  });

  it('should migrate true and non empty extends array', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      extends: 'foo',
      unpublishSafe: true,
    } as any);

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({
      extends: ['foo', 'npm:unpublishSafe'],
    });
  });

  it('should migrate true and empty extends array', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      extends: [],
      unpublishSafe: true,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({
      extends: ['npm:unpublishSafe'],
    });
  });

  it('should modify extends array', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      extends: ['foo', ':unpublishSafe', 'bar'],
      unpublishSafe: true,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({
      extends: ['foo', 'npm:unpublishSafe', 'bar'],
    });
  });

  it('should not modify extends array when unpublishSafe=false', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      extends: ['foo', 'bar'],
      unpublishSafe: false,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({
      extends: ['foo', 'bar'],
    });
  });
});
