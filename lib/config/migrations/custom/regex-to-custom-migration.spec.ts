import { RegexCustomMigration } from './regex-to-custom-migration';

describe('config/migrations/custom/regex-to-custom-migration', () => {
  it('should not update when regex not present', () => {
    expect(RegexCustomMigration).not.toMigrate(
      {
        enabledManagers: ['ansible', 'npm'],
      },
      {
        enabledManagers: ['ansible', 'npm'],
      }
    );
  });

  it('should migrate populated array', () => {
    expect(RegexCustomMigration).toMigrate(
      {
        enabledManagers: ['ansible', 'npm', 'regex'],
      },
      {
        enabledManagers: ['ansible', 'npm', 'custom'],
      }
    );
  });
});
