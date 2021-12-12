import { validateCustomMigration } from '../validator';
import { RequiredStatusChecksMigration } from './required-status-checks-migration';

describe('config/migrations/custom/required-status-checks-migration', () => {
  it('should migrate requiredStatusChecks=null to ignoreTests=true', () => {
    validateCustomMigration(
      RequiredStatusChecksMigration,
      {
        requiredStatusChecks: null,
      },
      {
        ignoreTests: true,
      }
    );
  });
});
