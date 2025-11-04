import { AutomergeMigration } from './automerge-migration';

describe('config/migrations/custom/automerge-migration', () => {
  it('should migrate none', async () => {
    await expect(AutomergeMigration).toMigrate(
      {
        automerge: 'none',
      } as any,
      {
        automerge: false,
      },
    );
  });

  it('should migrate patch', async () => {
    await expect(AutomergeMigration).toMigrate(
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

  it('should migrate minor', async () => {
    await expect(AutomergeMigration).toMigrate(
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

  it('should migrate any', async () => {
    await expect(AutomergeMigration).toMigrate(
      {
        automerge: 'any',
      } as any,
      {
        automerge: true,
      },
    );
  });
});
