import { validateCustomMigration } from '../validator';
import { RebaseStalePrsMigration } from './rebase-stale-prs-migration';

describe('config/migrations/custom/rebase-stale-prs-migration', () => {
  it('should migrate true', () => {
    validateCustomMigration(
      RebaseStalePrsMigration,
      {
        rebaseStalePrs: true,
      },
      {
        rebaseWhen: 'behind-base-branch',
      }
    );
  });

  it('should migrate false', () => {
    validateCustomMigration(
      RebaseStalePrsMigration,
      {
        rebaseStalePrs: false,
      },
      {
        rebaseWhen: 'conflicted',
      }
    );
  });

  it('should migrate null', () => {
    validateCustomMigration(
      RebaseStalePrsMigration,
      {
        rebaseStalePrs: null,
      },
      {
        rebaseWhen: 'auto',
      }
    );
  });
});
