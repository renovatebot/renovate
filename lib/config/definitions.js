// const logger = require('winston');

module.exports = {
  getOptions,
};

const options = [
  {
    name: 'enabled',
    description: 'Enable or disable renovate',
    type: 'boolean',
  },
  {
    name: 'onboarding',
    description: 'Require a Configuration PR first',
    type: 'boolean',
  },
  {
    name: 'platform',
    description: 'Platform type of repository',
    type: 'string',
    default: 'github',
  },
  {
    name: 'endpoint',
    description: 'Custom endpoint to use',
    type: 'string',
  },
  {
    name: 'token',
    description: 'Repository Auth Token',
    type: 'string',
  },
  {
    name: 'repositories',
    description: 'GitHub repositories',
    type: 'list',
    cli: false,
  },
  {
    name: 'packageFiles',
    description: 'Package file paths',
    type: 'list',
  },
  {
    name: 'depTypes',
    description: 'Dependency types',
    type: 'list',
    default: ['dependencies', 'devDependencies', 'optionalDependencies'],
  },
  // Version behaviour
  {
    name: 'ignoreDeps',
    description: 'Dependencies to ignore',
    type: 'list',
  },
  {
    name: 'ignoreFuture',
    description: 'Ignore versions tagged as "future"',
    type: 'boolean',
  },
  {
    name: 'ignoreUnstable',
    description: 'Ignore versions with unstable semver',
    type: 'boolean',
  },
  {
    name: 'respectLatest',
    description: 'Ignore versions newer than npm "latest" version',
    type: 'boolean',
  },
  // PR Behaviour
  {
    name: 'recreateClosed',
    description: 'Recreate PRs even if same ones were closed previously',
    type: 'boolean',
    default: false,
  },
  {
    name: 'rebaseStalePrs',
    description: 'Rebase stale PRs',
    type: 'boolean',
    default: false,
  },
  // String templates
  {
    name: 'branchName',
    description: 'Branch name template',
    type: 'string',
    default: 'renovate/{{depName}}-{{newVersionMajor}}.x',
    cli: false,
    env: false,
  },
  {
    name: 'commitMessage',
    description: 'Commit message template',
    type: 'string',
    default: 'Update dependency {{depName}} to version {{newVersion}}',
    cli: false,
    env: false,
  },
  {
    name: 'prTitle',
    description: 'Pull Request title template',
    type: 'string',
    default: '{{#if isPin}}Pin{{else}}Update{{/if}} dependency {{depName}} to version {{#if isMajor}}{{newVersionMajor}}.x{{else}}{{newVersion}}{{/if}}',
    cli: false,
    env: false,
  },
  {
    name: 'prBody',
    description: 'Pull Request body template',
    type: 'string',
    default: 'This Pull Request updates dependency {{depName}} from version {{currentVersion}} to {{newVersion}}\n\n{{changelog}}',
    cli: false,
    env: false,
  },
  // Pull Request options
  {
    name: 'labels',
    description: 'Labels to add to Pull Request',
    type: 'list',
  },
  {
    name: 'assignees',
    description: 'Assignees for Pull Request',
    type: 'list',
  },
  {
    name: 'reviewers',
    description: 'Requested reviewers for Pull Requests',
    type: 'list',
  },
  // Debug options
  {
    name: 'logLevel',
    description: 'Logging level',
    type: 'string',
    default: 'info',
    env: 'LOG_LEVEL',
  },
];

function getOptions() {
  return options;
}
