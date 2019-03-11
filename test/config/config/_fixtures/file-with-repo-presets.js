module.exports = {
  logLevel: 'error',
  extends: [':prHourlyLimit1', ':automergePatch'],
  automerge: true,
  separateMinorPatch: true,
  repositories: [
    'bar/baz',
    {
      repository: 'foo/bar',
      automerge: false,
    },
    {
      repository: 'renovatebot/renovate',
      extends: [':pinVersions']
    },
    {
      repository: 'rennovateapp/github-app-cli',
      extends: [':prHourlyLimit2']
    }
  ],
};
