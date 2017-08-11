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
    allowString: true,
    cli: false,
    env: false,
  },
  {
    name: 'onboarding',
    description: 'Require a Configuration PR first',
    stage: 'repository',
    type: 'boolean',
  },
  {
    name: 'platform',
    description: 'Platform type of repository',
    stage: 'repository',
    type: 'string',
    default: 'github',
  },
  {
    name: 'endpoint',
    description: 'Custom endpoint to use',
    stage: 'repository',
    type: 'string',
  },
  {
    name: 'token',
    description: 'Repository Auth Token',
    stage: 'repository',
    type: 'string',
  },
  {
    name: 'autodiscover',
    description: 'Autodiscover all repositories',
    stage: 'repository',
    type: 'boolean',
    default: false,
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
  },
  {
    name: 'packageFiles',
    description: 'Package file paths',
    type: 'list',
    stage: 'repository',
  },
  {
    name: 'ignoreNodeModules',
    description:
      'Skip any package.json files found within node_modules folders',
    type: 'boolean',
    stage: 'repository',
  },
  {
    name: 'dependencies',
    description: 'Configuration specifically for `package.json`>`dependencies`',
    stage: 'packageFile',
    type: 'json',
    default: { semanticPrefix: 'fix(deps):' },
    mergeable: true,
    cli: false,
  },
  {
    name: 'devDependencies',
    description:
      'Configuration specifically for `package.json`>`devDependencies`',
    stage: 'packageFile',
    type: 'json',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'optionalDependencies',
    description:
      'Configuration specifically for `package.json`>`optionalDependencies`',
    stage: 'packageFile',
    type: 'json',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'peerDependencies',
    description:
      'Configuration specifically for `package.json`>`peerDependencies`',
    stage: 'packageFile',
    type: 'json',
    default: { enabled: false },
    mergeable: true,
    cli: false,
  },
  // depType
  {
    name: 'ignoreDeps',
    description: 'Dependencies to ignore',
    type: 'list',
    stage: 'depType',
  },
  {
    name: 'packageRules',
    description: 'Rules for matching package names',
    type: 'list',
    stage: 'depType',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'packageNames',
    description:
      'Package names to match. Valid only within `packageRules` object',
    type: 'list',
    allowString: true,
    stage: 'depType',
    cli: false,
    env: false,
  },
  {
    name: 'excludePackageNames',
    description:
      'Package names to exclude. Valid only within `packageRules` object',
    type: 'list',
    allowString: true,
    stage: 'depType',
    cli: false,
    env: false,
  },
  {
    name: 'packagePatterns',
    description:
      'Package name patterns to match. Valid only within `packageRules` object.',
    type: 'list',
    allowString: true,
    stage: 'depType',
    cli: false,
    env: false,
  },
  {
    name: 'excludePackagePatterns',
    description:
      'Package name patterns to exclude. Valid only within `packageRules` object.',
    type: 'list',
    allowString: true,
    stage: 'depType',
    cli: false,
    env: false,
  },
  // Version behaviour
  {
    name: 'pinVersions',
    description: 'Convert ranged versions in package.json to pinned versions',
    stage: 'package',
    type: 'boolean',
    onboarding: true,
  },
  {
    name: 'separateMajorReleases',
    description:
      'If set to false, it will upgrade dependencies to latest release only, and not separate major/minor branches',
    stage: 'package',
    type: 'boolean',
  },
  {
    name: 'separatePatchReleases',
    description:
      'If set to true, it will separate minor and patch updates into separate branches',
    stage: 'package',
    type: 'boolean',
    default: false,
  },
  {
    name: 'ignoreFuture',
    description: 'Ignore versions tagged as "future"',
    stage: 'package',
    type: 'boolean',
  },
  {
    name: 'ignoreUnstable',
    description: 'Ignore versions with unstable semver',
    stage: 'package',
    type: 'boolean',
  },
  {
    name: 'respectLatest',
    description: 'Ignore versions newer than npm "latest" version',
    stage: 'package',
    type: 'boolean',
  },
  {
    name: 'branchPrefix',
    description: 'Prefix to use for all branch names',
    stage: 'branch',
    type: 'string',
    default: 'renovate/',
  },
  // Major/Minor/Patch
  {
    name: 'major',
    description: 'Configuration to apply when an update type is major',
    stage: 'package',
    type: 'json',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'minor',
    description: 'Configuration to apply when an update type is minor',
    stage: 'package',
    type: 'json',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'patch',
    description:
      'Configuration to apply when an update type is patch. Only applies if `separatePatchReleases` is set to true',
    stage: 'package',
    type: 'json',
    default: {
      branchName:
        '{{branchPrefix}}{{depName}}-{{newVersionMajor}}.{{newVersionMinor}}.x',
    },
    cli: false,
    mergeable: true,
  },
  // Semantic commit / Semantic release
  {
    name: 'semanticCommits',
    description: 'Enable semantic commit prefixes for commits and PR titles',
    type: 'boolean',
    default: null,
  },
  {
    name: 'semanticPrefix',
    description: 'Prefix to use if semantic commits are enabled',
    type: 'string',
    default: 'chore(deps):',
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
  {
    name: 'unpublishSafe',
    description: 'Set a status check for unpublish-safe upgrades',
    type: 'boolean',
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
      'What types of upgrades to merge to base branch automatically. Values: none, patch, minor or any',
    type: 'string',
    default: 'none',
  },
  {
    name: 'automergeType',
    description:
      'How to automerge - "branch-merge-commit", "branch-push" or "pr". Branch support is GitHub-only',
    type: 'string',
    default: 'pr',
  },
  {
    name: 'requiredStatusChecks',
    description:
      'List of status checks that must pass before automerging. Set to null to enable automerging without tests.',
    type: 'list',
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
  },
  {
    name: 'prBody',
    description: 'Pull Request body template',
    type: 'string',
    default: template('prBody'),
    cli: false,
  },
  // Yarn Lock Maintenance
  {
    name: 'lockFileMaintenance',
    description: 'Configuration for lock file maintenance',
    stage: 'packageFile',
    type: 'json',
    default: {
      enabled: true,
      groupName: 'Lock File Maintenance',
      recreateClosed: true,
      branchName: template('branchName', 'lock-file-maintenance'),
      commitMessage: template('commitMessage', 'lock-file-maintenance'),
      prTitle: template('prTitle', 'lock-file-maintenance'),
      prBody: template('prBody', 'lock-file-maintenance'),
      schedule: ['before 5am on monday'],
    },
    cli: false,
    mergeable: true,
  },
  // Dependency Groups
  {
    name: 'lazyGrouping',
    description: 'Use group names only when multiple dependencies upgraded',
    type: 'boolean',
    default: true,
  },
  {
    name: 'groupName',
    description: 'Human understandable name for the dependency group',
    type: 'string',
    default: null,
  },
  {
    name: 'groupSlug',
    description:
      'Slug to use for group (e.g. in branch name). Will be calculated from groupName if null',
    type: 'string',
    default: null,
    cli: false,
    env: false,
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
