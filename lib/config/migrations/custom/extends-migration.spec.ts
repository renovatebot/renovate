import { GlobalConfig } from '../../global';
import { removedPresets } from '../../presets/common';
import { MigrationsService } from './../migrations-service';

describe('config/migrations/custom/extends-migration', () => {
  it('should migrate removed preset', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      extends: Object.keys(removedPresets),
    } as any);
    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({
      extends: Object.values(removedPresets).filter(Boolean),
    });
  });

  it('should migrate string to array', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      extends: 'foo',
    } as any);
    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({ extends: ['foo'] });
  });

  it('should migrate array items', () => {
    const { isMigrated, migratedConfig } = MigrationsService.run({
      extends: ['foo', ':js-app', 'bar'],
    });
    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toMatchObject({
      extends: ['foo', 'config:js-app', 'bar'],
    });
  });

  it('should migrate by global config', () => {
    GlobalConfig.set({
      migratePresets: {
        '@org': 'local>org/renovate-config',
        '@org2/foo': '',
      },
    });

    const { isMigrated, migratedConfig } = MigrationsService.run({
      extends: ['@org', '@org2/foo'],
    });

    GlobalConfig.reset();

    expect(isMigrated).toBeTrue();
    expect(migratedConfig).toEqual({ extends: ['local>org/renovate-config'] });
  });
});
