import { MasterIssueMigration } from './master-issue-migration';

describe('config/migrations/custom/master-issue-migration', () => {
  it('should migrate string "true"', () => {
    expect(MasterIssueMigration).toMigrate(
      {
        masterIssue: 'true',
      },
      {
        dependencyDashboard: true,
      }
    );
  });

  it('should migrate string "false"', () => {
    expect(MasterIssueMigration).toMigrate(
      {
        masterIssue: 'false',
      },
      {
        dependencyDashboard: 'false',
      } as any
    );
  });

  it('should migrate any value', () => {
    expect(MasterIssueMigration).toMigrate(
      {
        masterIssue: 'test',
      },
      {
        dependencyDashboard: 'test',
      } as any
    );
  });
});
