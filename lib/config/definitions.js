const fs = require('fs');
const path = require('path');

function template(name, subdir = 'default/') {
  const shortName = `${name.replace(/([A-Z])/g, '-$1').toLowerCase()}.hbs`;
  const hbsContents = fs.readFileSync(
    // Long path is so that it works whether code is run from lib or dist
    path.resolve(__dirname, '../config/templates/', subdir, shortName),
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
    stage: 'package',
    type: 'boolean',
    cli: false,
    env: false,
  },
  // Log options
  {
    name: 'logLevel',
    description: 'Logging level',
    stage: 'global',
    type: 'string',
    default: 'info',
    env: 'LOG_LEVEL',
  },
  {
    name: 'logFile',
    description: 'Log file path',
    stage: 'global',
    type: 'string',
  },
  {
    name: 'logFileLevel',
    description: 'Log file log level',
    stage: 'global',
    type: 'string',
    default: 'debug',
  },
  // Onboarding
  {
    name: 'onboarding',
    description: 'Require a Configuration PR first',
    stage: 'repository',
    type: 'boolean',
    onboarding: false,
  },
  // Scheduling
  {
    name: 'timezone',
    description:
      '[IANA Time Zone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)',
    type: 'string',
  },
  {
    name: 'schedule',
    description: 'Times of day/week to renovate',
    type: 'list',
    cli: false,
    env: false,
  },
  {
    name: 'onboarding',
    description: 'Require a Configuration PR first',
    stage: 'repository',
    type: 'boolean',
    onboarding: false,
  },
  {
    name: 'platform',
    description: 'Platform type of repository',
    stage: 'repository',
    type: 'string',
    default: 'github',
    onboarding: false,
  },
  {
    name: 'endpoint',
    description: 'Custom endpoint to use',
    stage: 'repository',
    type: 'string',
    onboarding: false,
  },
  {
    name: 'token',
    description: 'Repository Auth Token',
    stage: 'repository',
    type: 'string',
    onboarding: false,
  },
  {
    name: 'autodiscover',
    description: 'Autodiscover all repositories',
    stage: 'repository',
    type: 'boolean',
    default: false,
    onboarding: false,
  },
  {
    name: 'githubAppId',
    description: 'GitHub App ID (enables GitHub App functionality if set)',
    stage: 'global',
    type: 'integer',
  },
  {
    name: 'githubAppKey',
    description: 'GitHub App Private Key (.pem file contents)',
    stage: 'global',
    type: 'string',
  },
  {
    name: 'repositories',
    description: 'List of Repositories',
    stage: 'global',
    type: 'list',
    cli: false,
  },
  {
    name: 'baseBranch',
    description:
      'Base branch to target for Pull Requests. Otherwise default branch is used',
    stage: 'repository',
    type: 'string',
    cli: false,
    env: false,
    onboarding: false,
  },
  {
    name: 'packageFiles',
    description: 'Package file paths',
    type: 'list',
    stage: 'repository',
  },
  {
    name: 'depTypes',
    description: 'Dependency types',
    stage: 'packageFile',
    type: 'list',
    default: [
      { depType: 'dependencies', semanticPrefix: 'fix(deps): ' },
      'devDependencies',
      'optionalDependencies',
    ],
  },
  // depType
  {
    name: 'ignoreDeps',
    description: 'Dependencies to ignore',
    type: 'list',
    stage: 'depType',
  },
  {
    name: 'packages',
    description: 'Package Rules',
    type: 'list',
    stage: 'depType',
    cli: false,
    env: false,
    onboarding: false,
  },
  // Version behaviour
  {
    name: 'pinVersions',
    description: 'Convert ranged versions in package.json to pinned versions',
    stage: 'package',
    type: 'boolean',
  },
  {
    name: 'separateMajorReleases',
    description:
      'If set to false, it will upgrade dependencies to latest release only, and not separate major/minor branches',
    stage: 'package',
    type: 'boolean',
  },
  {
    name: 'ignoreFuture',
    description: 'Ignore versions tagged as "future"',
    stage: 'package',
    type: 'boolean',
    onboarding: false,
  },
  {
    name: 'ignoreUnstable',
    description: 'Ignore versions with unstable semver',
    stage: 'package',
    type: 'boolean',
    onboarding: false,
  },
  {
    name: 'respectLatest',
    description: 'Ignore versions newer than npm "latest" version',
    stage: 'package',
    type: 'boolean',
    onboarding: false,
  },
  // Semantic commit / Semantic release
  {
    name: 'semanticCommits',
    description: 'Enable semantic commit prefixes for commits and PR titles',
    type: 'boolean',
    default: false,
  },
  {
    name: 'semanticPrefix',
    description: 'Prefix to use if semantic commits are enabled',
    type: 'string',
    default: 'chore(deps): ',
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
  {
    name: 'requiredStatusChecks',
    description:
      'List of status checks that must pass before automerging. Set to null to enable automerging without tests.',
    type: 'list',
    onboarding: false,
    cli: false,
    env: false,
  },
  // Default templates
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
    stage: 'global',
    type: 'string',
    default: '/tmp/yarn-cache',
    cli: false,
  },
  {
    name: 'lockFileMaintenance',
    description: 'Configuration for lock file maintenance',
    stage: 'packageFile',
    type: 'json',
    default: {
      enabled: true,
      recreateClosed: true,
      branchName: template('branchName', 'lock-file-maintenance'),
      commitMessage: template('commitMessage', 'lock-file-maintenance'),
      prTitle: template('prTitle', 'lock-file-maintenance'),
      prBody: template('prBody', 'lock-file-maintenance'),
      schedule: 'before 5am on monday',
    },
    cli: false,
    env: false,
    onboarding: false,
    mergeable: true,
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
    cli: false,
    env: false,
    onboarding: false,
  },
  {
    name: 'group',
    description: 'Config if groupName is enabled',
    type: 'json',
    default: {
      recreateClosed: true,
      branchName: template('branchName', 'group'),
      commitMessage: template('commitMessage', 'group'),
      prTitle: template('prTitle', 'group'),
      prBody: template('prBody', 'group'),
    },
    cli: false,
    env: false,
    onboarding: false,
    mergeable: true,
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
];

function getOptions() {
  return options;
}
