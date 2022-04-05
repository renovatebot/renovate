import { GradleLiteMigration } from './gradle-lite-migration';

describe('config/migrations/custom/gradle-lite-migration', () => {
  it('should migrate non empty object', () => {
    expect(GradleLiteMigration).toMigrate(
      {
        'gradle-lite': {
          enabled: true,
          fileMatch: ['foo'],
        },
      },
      {
        gradle: {
          enabled: true,
          fileMatch: ['foo'],
        },
      }
    );
  });

  it('should override existing gradle config', () => {
    expect(GradleLiteMigration).toMigrate(
      {
        gradle: {
          enabled: false,
        },
        'gradle-lite': {
          enabled: true,
          fileMatch: ['foo'],
        },
      },
      {
        gradle: {
          enabled: true,
          fileMatch: ['foo'],
        },
      }
    );
  });

  it('should just remove empty object', () => {
    expect(GradleLiteMigration).toMigrate(
      {
        'gradle-lite': {},
      },
      {}
    );
  });
});
