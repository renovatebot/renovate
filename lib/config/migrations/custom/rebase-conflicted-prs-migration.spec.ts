import { getCustomMigrationValidator } from '../validator';
import { RebaseConflictedPrs } from './rebase-conflicted-prs-migration';

describe('config/migrations/custom/rebase-conflicted-prs-migration', () => {
  const validate = getCustomMigrationValidator(RebaseConflictedPrs);

  it('should migrate false', () => {
    validate(
      {
        rebaseConflictedPrs: false,
      },
      {
        rebaseWhen: 'never',
      }
    );
  });
});
