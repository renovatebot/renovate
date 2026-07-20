import { AutomergeMigration } from './automerge-migration.ts';

describe('config/migrations/custom/automerge-migration', () => {
  it('should migrate none', async () => {
    await expect(AutomergeMigration).toMigrate(
      {
        automerge: 'none',
      },
      {
        automerge: false,
      },
    );
  });

  it('should migrate patch', async () => {
    await expect(AutomergeMigration).toMigrate(
      {
        automerge: 'patch',
      },
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

  it('should migrate minor', async () => {
    await expect(AutomergeMigration).toMigrate(
      {
        automerge: 'minor',
      },
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

  it('should migrate any', async () => {
    await expect(AutomergeMigration).toMigrate(
      {
        automerge: 'any',
      },
      {
        automerge: true,
      },
    );
  });
});
