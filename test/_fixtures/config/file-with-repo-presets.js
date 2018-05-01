module.exports = {
  logLevel: 'error',
  extends: [':prHourlyLimit1', ':automergePatch'],
  upgradeInRange: true,
  separatePatchReleases: true,
  repositories: [
    'bar/baz',
    {
      repository: 'foo/bar',
      upgradeInRange: false,
    },
    {
      repository: 'renovateapp/renovate',
      extends: [':pinVersions']
    },
    {
      repository: 'rennovateapp/github-app-cli',
      extends: [':prHourlyLimit2']
    }
  ],
};
