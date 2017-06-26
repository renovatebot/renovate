const fs = require('fs');
const path = require('path');

function template(name) {
  const shortName = `${name.replace(/([A-Z])/g, '-$1').toLowerCase()}.hbs`;
  const hbsContents = fs.readFileSync(
    // Long path is so that it works whether code is run from lib or dist
    path.resolve(__dirname, '../../lib/config/templates/', shortName),
    'utf8'
  );
  // Strip off any trailing line break
  return hbsContents.replace(/\n$/, '');
}

module.exports = {
  getOptions,
};

const options = [
  {
    name: 'enabled',
    description: 'Enable or disable renovate',
    level: 'packageFile',
    type: 'boolean',
  },
  {
    name: 'logFile',
    description: 'Log file path',
    level: 'global',
    type: 'string',
  },
  {
    name: 'logFileLevel',
    description: 'Log file log level',
    level: 'global',
    type: 'string',
    default: 'debug',
  },
  {
    name: 'onboarding',
    description: 'Require a Configuration PR first',
    level: 'repository',
    type: 'boolean',
    onboarding: false,
  },
  {
    name: 'platform',
    description: 'Platform type of repository',
    level: 'repository',
    type: 'string',
    default: 'github',
    onboarding: false,
  },
  {
    name: 'endpoint',
    description: 'Custom endpoint to use',
    level: 'repository',
    type: 'string',
    onboarding: false,
  },
  {
    name: 'token',
    description: 'Repository Auth Token',
    level: 'repository',
    type: 'string',
    onboarding: false,
  },
  {
    name: 'autodiscover',
    description: 'Autodiscover all repositories',
    level: 'repository',
    type: 'boolean',
    default: false,
    onboarding: false,
  },
  {
    name: 'githubAppId',
    description: 'GitHub App ID (enables GitHub App functionality if set)',
    level: 'global',
    type: 'integer',
  },
  {
    name: 'githubAppKey',
    description: 'GitHub App Private Key (.pem file contents)',
    level: 'global',
    type: 'string',
  },
  {
    name: 'repositories',
    description: 'List of Repositories',
    level: 'global',
    type: 'list',
    cli: false,
  },
  {
    name: 'packageFiles',
    description: 'Package file paths',
    type: 'list',
    level: 'repository',
  },
  {
    name: 'depTypes',
    description: 'Dependency types',
    level: 'packageFile',
    type: 'list',
    default: ['dependencies', 'devDependencies', 'optionalDependencies'],
  },
  // Version behaviour
  {
    name: 'pinVersions',
    description: 'Convert ranged versions in package.json to pinned versions',
    type: 'boolean',
  },
  {
    name: 'separateMajorReleases',
    description:
      'If set to false, it will upgrade dependencies to latest release only, and not separate major/minor branches',
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
    onboarding: false,
  },
  {
    name: 'ignoreUnstable',
    description: 'Ignore versions with unstable semver',
    type: 'boolean',
    onboarding: false,
  },
  {
    name: 'respectLatest',
    description: 'Ignore versions newer than npm "latest" version',
    type: 'boolean',
    onboarding: false,
  },
  // PR Behaviour
  {
    name: 'recreateClosed',
    description: 'Recreate PRs even if same ones were closed previously',
    type: 'boolean',
    default: false,
    onboarding: false,
  },
  {
    name: 'rebaseStalePrs',
    description: 'Rebase stale PRs (GitHub only)',
    type: 'boolean',
    default: false,
  },
  {
    name: 'prCreation',
    description:
      'When to create the PR for a branch. Values: immediate, not-pending, status-success.',
    type: 'string',
    default: 'immediate',
  },
  // Automatic merging
  {
    name: 'automerge',
    description:
      'What types of upgrades to merge to base branch automatically. Values: none, minor or any',
    type: 'string',
    default: 'none',
  },
  {
    name: 'automergeType',
    description:
      'How to automerge - "branch-merge-commit", "branch-push" or "pr". Branch support is GitHub-only',
    type: 'string',
    default: 'pr',
    onboarding: false,
  },
  // String templates
  {
    name: 'branchName',
    description: 'Branch name template',
    type: 'string',
    default: template('branchName'),
    cli: false,
  },
  {
    name: 'commitMessage',
    description: 'Commit message template',
    type: 'string',
    default: template('commitMessage'),
    cli: false,
  },
  {
    name: 'prTitle',
    description: 'Pull Request title template',
    type: 'string',
    default: template('prTitle'),
    cli: false,
    onboarding: false,
  },
  {
    name: 'prBody',
    description: 'Pull Request body template',
    type: 'string',
    default: template('prBody'),
    cli: false,
    onboarding: false,
  },
  // Yarn Lock Maintenance
  {
    name: 'yarnCacheFolder',
    description:
      'Location of yarn cache folder to use. Set to empty string to disable',
    level: 'global',
    type: 'string',
    default: '/tmp/yarn-cache',
  },
  {
    name: 'maintainYarnLock',
    description: 'Keep yarn.lock files updated in base branch',
    level: 'packageFile',
    type: 'boolean',
    default: false,
  },
  {
    name: 'yarnMaintenanceBranchName',
    description: 'Branch name template when maintaining yarn.lock',
    level: 'packageFile',
    type: 'string',
    default: 'renovate/yarn-lock',
    cli: false,
    onboarding: false,
  },
  {
    name: 'yarnMaintenanceCommitMessage',
    description: 'Commit message template when maintaining yarn.lock',
    level: 'packageFile',
    type: 'string',
    default: 'Renovate yarn.lock file',
    cli: false,
    onboarding: false,
  },
  {
    name: 'yarnMaintenancePrTitle',
    description: 'Pull Request title template when maintaining yarn.lock',
    level: 'packageFile',
    type: 'string',
    default: 'Renovate yarn.lock file',
    cli: false,
    onboarding: false,
  },
  {
    name: 'yarnMaintenancePrBody',
    description: 'Pull Request body template when maintaining yarn.lock',
    level: 'packageFile',
    type: 'string',
    default:
      'This PR regenerates yarn.lock files based on the existing `package.json` files.',
    cli: false,
    onboarding: false,
  },
  // Dependency Groups
  {
    name: 'lazyGrouping',
    description: 'Use group names only when multiple dependencies upgraded',
    type: 'boolean',
    default: true,
    onboarding: false,
  },
  {
    name: 'groupName',
    description: 'Human understandable name for the dependency group',
    type: 'string',
    default: null,
    onboarding: false,
  },
  {
    name: 'groupSlug',
    description:
      'Slug to use for group (e.g. in branch name). Will be calculated from groupName if null',
    type: 'string',
    default: null,
    onboarding: false,
  },
  {
    name: 'groupBranchName',
    description: 'Branch name template for the group',
    type: 'string',
    default: template('groupBranchName'),
    cli: false,
    onboarding: false,
  },
  {
    name: 'groupCommitMessage',
    description: 'Group commit message',
    type: 'string',
    default: template('groupCommitMessage'),
    cli: false,
    onboarding: false,
  },
  {
    name: 'groupPrTitle',
    description: 'Pull Request title template for the group',
    type: 'string',
    default: template('groupPrTitle'),
    cli: false,
    onboarding: false,
  },
  {
    name: 'groupPrBody',
    description: 'Pull Request body template for the group',
    type: 'string',
    default: template('groupPrBody'),
    cli: false,
    onboarding: false,
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
  // Debug options
  {
    name: 'logLevel',
    description: 'Logging level',
    level: 'global',
    type: 'string',
    default: 'info',
    env: 'LOG_LEVEL',
  },
];

function getOptions() {
  return options;
}
