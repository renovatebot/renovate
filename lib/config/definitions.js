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
    description: 'List of Repositories',
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
    name: 'separateMajorReleases',
    description: 'If set to false, it will upgrade dependencies to latest release only, and not separate major/minor branches',
    type: 'boolean',
  },
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
    description: 'Rebase stale PRs (GitHub only)',
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
    default: '{{#if isPin}}Pin{{else}}Update{{/if}} dependency {{depName}} to version {{#if isRange}}{{newVersion}}{{else}}{{#if isMajor}}{{newVersionMajor}}.x{{else}}{{newVersion}}{{/if}}{{/if}}',
    cli: false,
    env: false,
  },
  {
    name: 'prBody',
    description: 'Pull Request body template',
    type: 'string',
    default: 'This Pull Request updates dependency {{depName}} from version `{{currentVersion}}` to `{{newVersion}}`\n\n{{changelog}}',
    cli: false,
    env: false,
  },
  // Yarn Lock Maintenance
  {
    name: 'maintainYarnLock',
    description: 'Keep yarn.lock updated in base branch (no monorepo support)',
    type: 'boolean',
    default: false,
  },
  {
    name: 'yarnMaintenanceBranchName',
    description: 'Branch name template when maintaining yarn.lock',
    type: 'string',
    default: 'renovate/yarn-lock',
    cli: false,
    env: false,
  },
  {
    name: 'yarnMaintenanceCommitMessage',
    description: 'Commit message template when maintaining yarn.lock',
    type: 'string',
    default: 'Renovate yarn.lock file',
    cli: false,
    env: false,
  },
  {
    name: 'yarnMaintenancePrTitle',
    description: 'Pull Request title template when maintaining yarn.lock',
    type: 'string',
    default: 'Renovate yarn.lock file',
    cli: false,
    env: false,
  },
  {
    name: 'yarnMaintenancePrBody',
    description: 'Pull Request body template when maintaining yarn.lock',
    type: 'string',
    default: 'This PR regenerates yarn.lock files based on the existing `package.json` files.',
    cli: false,
    env: false,
  },
  // Dependency Groups
  {
    name: 'groupName',
    description: 'Human understandable name for the dependency group',
    type: 'string',
    default: null,
  },
  {
    name: 'groupSlug',
    description: 'Slug to use for group (e.g. in branch name). Will be calculated from groupName if null',
    type: 'string',
    default: null,
  },
  {
    name: 'groupBranchName',
    description: 'Branch name template for the group',
    type: 'string',
    default: 'renovate/{{groupSlug}}',
    cli: false,
    env: false,
  },
  {
    name: 'groupCommitMessage',
    description: 'Group commit message',
    type: 'string',
    default: 'Renovate {{groupName}} packages',
    cli: false,
    env: false,
  },
  {
    name: 'groupPrTitle',
    description: 'Pull Request title template for the group',
    type: 'string',
    default: 'Renovate {{groupName}} packages',
    cli: false,
    env: false,
  },
  {
    name: 'groupPrBody',
    description: 'Pull Request body template for the group',
    type: 'string',
    default: 'This PR renovates the package group "{{groupName}}".',
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
    description: 'Requested reviewers for Pull Requests (GitHub only)',
    type: 'list',
  },
  {
    name: 'pinVersions',
    description: 'Convert ranged versions in package.json to pinned versions',
    type: 'boolean',
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
