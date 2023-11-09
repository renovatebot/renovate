import { GlobalConfig } from '../../global';
import { ExtendsMigration } from './extends-migration';

describe('config/migrations/custom/extends-migration', () => {
  it('it migrates preset strings to array', () => {
    expect(ExtendsMigration).toMigrate(
      {
        extends: ':js-app',
      } as any,
      {
        extends: ['config:js-app'],
      },
    );

    expect(ExtendsMigration).toMigrate(
      {
        extends: 'foo',
      } as any,
      {
        extends: ['foo'],
      },
    );
  });

  it('it migrates presets array', () => {
    expect(ExtendsMigration).toMigrate(
      {
        extends: ['foo', ':js-app', 'bar'],
      },
      {
        extends: ['foo', 'config:js-app', 'bar'],
      },
    );
  });

  it('should remove non string values', () => {
    expect(ExtendsMigration).toMigrate(
      {
        extends: [{}],
      } as any,
      {
        extends: [],
      },
    );
  });

  it('should remove removed presets', () => {
    expect(ExtendsMigration).toMigrate(
      {
        extends: ['helpers:oddIsUnstable'],
      },
      {
        extends: [],
      },
    );
  });

  it('it migrates presets', () => {
    GlobalConfig.set({
      migratePresets: {
        '@org': 'local>org/renovate-config',
        '@org2/foo': '',
      },
    });
    expect(ExtendsMigration).toMigrate(
      {
        extends: ['@org', '@org2/foo'],
      },
      {
        extends: ['local>org/renovate-config'],
      },
    );
    GlobalConfig.reset();
  });

  it('migrate merge confidence config preset to internal preset', () => {
    expect(ExtendsMigration).toMigrate(
      {
        extends: ['github>whitesource/merge-confidence:beta'],
      },
      {
        extends: ['mergeConfidence:all-badges'],
      },
    );
  });
});
