module.exports = {
  enabled: true,
  packageFiles: [], // Autodiscover
  depTypes: ['dependencies', 'devDependencies', 'optionalDependencies'],
  ignoreDeps: [],
  assignees: [],
  labels: [],
  branchName: 'renovate/{{depName}}-{{newVersionMajor}}.x',
  commitMessage: 'Update dependency {{depName}} to version {{newVersion}}',
  prTitle: '{{#if isPin}}Pin{{else}}Update{{/if}} dependency {{depName}} to version {{#if isMajor}}{{newVersionMajor}}.x{{else}}{{newVersion}}{{/if}}',
  prBody: 'This Pull Request updates dependency {{depName}} from version {{currentVersion}} to {{newVersion}}\n\n{{changelog}}',
  ignoreFuture: true,
  ignoreUnstable: true,
  respectLatest: true,
  recreateClosed: false,
  recreateUnmergeable: true,
  logLevel: 'info',
};
