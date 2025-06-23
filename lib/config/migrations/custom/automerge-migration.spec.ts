import { AutomergeMigration } from './automerge-migration';

describe('config/migrations/custom/automerge-migration', () => {
  it('should migrate none', () => {
    expect(AutomergeMigration).toMigrate(
      {
        automerge: 'none',
      } as any,
      {
        automerge: false,
      },
    );
  });

  it('should migrate patch', () => {
    expect(AutomergeMigration).toMigrate(
      {
        automerge: 'patch',
      } as any,
      {
        patch: {
          automerge: true,
        },
        minor: {
          automerge: false,
        },
        major: {
          automerge: false,
        },
      },
    );
  });

  it('should migrate minor', () => {
    expect(AutomergeMigration).toMigrate(
      {
        automerge: 'minor',
      } as any,
      {
        minor: {
          automerge: true,
        },
        major: {
          automerge: false,
        },
      },
    );
  });

  it('should migrate any', () => {
    expect(AutomergeMigration).toMigrate(
      {
        automerge: 'any',
      } as any,
      {
        automerge: true,
      },
    );
  });
});
