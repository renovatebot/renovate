module.exports = {
  force: {
    vulnerabilityAlertsOnly: true,
  },
  enabledManagers: ['npm', 'pip_requirements'],
  packageRules: [
    {
      packagePatterns: ['.*'],
      enabled: false,
    },
  ],
  onboarding: false,
  branchPrefix: 'renovate-vulnerable/',
  prFooter:
    'This [Vulnerability Alert](https://github.com/apps/vulnerability-alerts) has been raised by [Renovate Bot](https://renovatebot.com)',
};
