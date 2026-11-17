import { DependencyDashboardMigration } from './dependency-dashboard-migration.ts';

describe('config/migrations/custom/dependency-dashboard-migration', () => {
  it('moves the flat options into the dependencyDashboard object', async () => {
    await expect(DependencyDashboardMigration).toMigrate(
      {
        dependencyDashboardAutoclose: true,
        dependencyDashboardTitle: 'Dashboard',
        dependencyDashboardHeader: 'header',
        dependencyDashboardFooter: 'footer',
        dependencyDashboardLabels: ['dashboard'],
        dependencyDashboardOSVVulnerabilitySummary: 'all',
        dependencyDashboardReportAbandonment: false,
        customizeDashboard: { repoProblemsHeader: 'problems' },
      },
      {
        dependencyDashboard: {
          autoclose: true,
          title: 'Dashboard',
          header: 'header',
          footer: 'footer',
          labels: ['dashboard'],
          osvVulnerabilitySummary: 'all',
          reportAbandonment: false,
          customize: { repoProblemsHeader: 'problems' },
        },
      },
    );
  });

  it('keeps a boolean dependencyDashboard which comes before the flat options', async () => {
    await expect(DependencyDashboardMigration).toMigrate(
      {
        dependencyDashboard: false,
        dependencyDashboardTitle: 'Dashboard',
      },
      {
        dependencyDashboard: { enabled: false, title: 'Dashboard' },
      },
    );
  });

  it('keeps a boolean dependencyDashboard which comes after the flat options', async () => {
    await expect(DependencyDashboardMigration).toMigrate(
      {
        dependencyDashboardTitle: 'Dashboard',
        dependencyDashboard: true,
      },
      {
        dependencyDashboard: { enabled: true, title: 'Dashboard' },
      },
    );
  });

  it('keeps a string boolean dependencyDashboard', async () => {
    await expect(DependencyDashboardMigration).toMigrate(
      {
        dependencyDashboardTitle: 'Dashboard',
        dependencyDashboard: 'false',
      },
      {
        dependencyDashboard: { enabled: false, title: 'Dashboard' },
      },
    );
  });

  it('migrates a standalone string boolean dependencyDashboard', async () => {
    await expect(DependencyDashboardMigration).toMigrate(
      { dependencyDashboard: 'true' },
      { dependencyDashboard: { enabled: true } },
    );
  });

  it('leaves an invalid dependencyDashboard and the flat options for validation', async () => {
    await expect(DependencyDashboardMigration).toMigrate(
      {
        dependencyDashboard: 'yes',
        dependencyDashboardTitle: 'Dashboard',
      },
      {
        dependencyDashboard: 'yes',
        dependencyDashboardTitle: 'Dashboard',
      },
      false,
    );
  });

  it('prefers values already in the dependencyDashboard object', async () => {
    await expect(DependencyDashboardMigration).toMigrate(
      {
        dependencyDashboard: { enabled: true, title: 'New' },
        dependencyDashboardTitle: 'Old',
        dependencyDashboardAutoclose: true,
      },
      {
        dependencyDashboard: { enabled: true, title: 'New', autoclose: true },
      },
    );
  });
});
