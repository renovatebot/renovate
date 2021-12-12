import { getCustomMigrationValidator } from '../validator';
import { RebaseStalePrsMigration } from './rebase-stale-prs-migration';

describe('config/migrations/custom/rebase-stale-prs-migration', () => {
  const validate = getCustomMigrationValidator(RebaseStalePrsMigration);

  it('should migrate true', () => {
    validate(
      {
        rebaseStalePrs: true,
      },
      {
        rebaseWhen: 'behind-base-branch',
      }
    );
  });

  it('should migrate false', () => {
    validate(
      {
        rebaseStalePrs: false,
      },
      {
        rebaseWhen: 'conflicted',
      }
    );
  });

  it('should migrate null', () => {
    validate(
      {
        rebaseStalePrs: null,
      },
      {
        rebaseWhen: 'auto',
      }
    );
  });
});
