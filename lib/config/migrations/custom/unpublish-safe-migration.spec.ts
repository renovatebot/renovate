import { UnpublishSafeMigration } from './unpublish-safe-migration';

describe('config/migrations/custom/unpublish-safe-migration', () => {
  it('should migrate true', () => {
    expect(UnpublishSafeMigration).toMigrate(
      {
        unpublishSafe: true,
      },
      {
        extends: ['npm:unpublishSafe'],
      },
    );
  });

  it('should migrate true and handle extends field', () => {
    expect(UnpublishSafeMigration).toMigrate(
      {
        extends: 'test',
        unpublishSafe: true,
      } as any,
      {
        extends: ['test', 'npm:unpublishSafe'],
      },
    );
  });

  it('should migrate true and handle empty extends field', () => {
    expect(UnpublishSafeMigration).toMigrate(
      {
        extends: [],
        unpublishSafe: true,
      } as any,
      {
        extends: ['npm:unpublishSafe'],
      },
    );
  });

  it('should migrate true and save order of items inside extends field', () => {
    expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['foo', ':unpublishSafe', 'bar'],
        unpublishSafe: true,
      } as any,
      {
        extends: ['foo', 'npm:unpublishSafe', 'bar'],
      },
    );

    expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['foo', 'default:unpublishSafe', 'bar'],
        unpublishSafe: true,
      } as any,
      {
        extends: ['foo', 'npm:unpublishSafe', 'bar'],
      },
    );

    expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['foo', 'npm:unpublishSafe', 'bar'],
        unpublishSafe: true,
      } as any,
      {
        extends: ['foo', 'npm:unpublishSafe', 'bar'],
      },
    );
  });

  it('should migrate false and save order of items inside extends field', () => {
    expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['foo', 'bar'],
        unpublishSafe: false,
      } as any,
      {
        extends: ['foo', 'bar'],
      },
    );
  });

  it('prevent duplicates', () => {
    expect(UnpublishSafeMigration).toMigrate(
      {
        extends: ['npm:unpublishSafe'],
        unpublishSafe: true,
      },
      {
        extends: ['npm:unpublishSafe'],
      },
    );
  });
});
