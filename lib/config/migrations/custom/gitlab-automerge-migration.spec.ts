import { MigrationsService } from '../migrations-service';

describe('config/migrations/custom/gitlab-automerge-migration', () => {
  it('should migrate true', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      gitLabAutomerge: true,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({ platformAutomerge: true });
  });

  it('should migrate false', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      gitLabAutomerge: false,
    });

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({ platformAutomerge: false });
  });
});
