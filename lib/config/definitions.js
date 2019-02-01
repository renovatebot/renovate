const { appName, appSlug, urls } = require('./app-strings');

module.exports = {
  getOptions,
};

const options = [
  {
    name: 'extends',
    description:
      'Configuration presets to use/extend. Note: does not work if configured in config.js',
    stage: 'package',
    type: 'list',
    allowString: true,
    cli: false,
  },
  {
    name: 'description',
    description: 'Plain text description for a config or preset',
    type: 'list',
    stage: 'repository',
    allowString: true,
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'enabled',
    description: `Enable or disable ${appName}`,
    stage: 'package',
    type: 'boolean',
    cli: false,
    env: false,
  },
  {
    name: 'force',
    description:
      'Any configuration defined within this object will force override existing settings',
    stage: 'package',
    admin: true,
    type: 'json',
    cli: false,
    env: false,
  },
  {
    name: 'forceCli',
    description:
      'Whether CLI configuration options should be moved to the `force` config section',
    stage: 'global',
    type: 'boolean',
    default: false,
  },
  {
    name: 'dryRun',
    description:
      'If enabled, perform a dry run by logging messages instead of creating/updating/deleting branches and PRs',
    type: 'boolean',
    admin: true,
    default: false,
  },
  {
    name: 'printConfig',
    description:
      'If enabled, log the full resolved config for each repo, including resolved presets',
    type: 'boolean',
    admin: true,
    default: false,
  },
  {
    name: 'binarySource',
    description:
      'Where to source binaries like `npm` and `yarn` from, choices are `bundled`, `global` and `docker`',
    admin: true,
    type: 'string',
    default: 'bundled',
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
    admin: true,
  },
  {
    name: 'onboardingConfig',
    description: 'Configuration to use in onboarding PRs',
    stage: 'repository',
    type: 'json',
    default: {},
    admin: true,
    mergeable: true,
    cli: false,
  },
  {
    name: 'includeForks',
    description:
      'Whether to process forked repositories or not. By default, all forked repositories are skipped over.',
    stage: 'repository',
    type: 'boolean',
    default: false,
  },
  {
    name: 'forkMode',
    description:
      'Set to true to fork the source repository and create branches there instead',
    stage: 'repository',
    type: 'boolean',
    default: false,
    admin: true,
  },
  {
    name: 'requireConfig',
    description: 'Set to true if repositories must have a config to activate.',
    stage: 'repository',
    type: 'boolean',
    default: false,
    admin: true,
  },
  // encryption
  {
    name: 'privateKey',
    description: 'Server-side private key',
    stage: 'repository',
    type: 'string',
    replaceLineReturns: true,
    admin: true,
  },
  {
    name: 'encrypted',
    description:
      'A configuration object containing configuration encrypted with project key.',
    stage: 'repository',
    type: 'json',
    default: null,
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
    description: 'Times of day/week to limit branch creation to',
    type: 'list',
    allowString: true,
    cli: true,
    env: false,
    default: 'at any time',
  },
  {
    name: 'updateNotScheduled',
    description:
      'Whether to update (but not create) branches when not scheduled',
    stage: 'branch',
    type: 'boolean',
  },
  // Bot administration
  {
    name: 'gitFs',
    description: 'Use git for FS operations instead of API. GitHub only.',
    type: 'string',
    allowedValues: ['https', 'http', 'ssh'],
    admin: true,
    default: null,
  },
  {
    name: 'trustLevel',
    description:
      'Set this to "high" if the bot should trust the repository owners/contents',
    stage: 'global',
    type: 'string',
    default: 'low',
  },
  {
    name: 'platform',
    description: 'Platform type of repository',
    type: 'string',
    default: 'github',
    admin: true,
  },
  {
    name: 'endpoint',
    description: 'Custom endpoint to use',
    stage: 'repository',
    type: 'string',
    admin: true,
    default: null,
  },
  {
    name: 'token',
    description: 'Repository Auth Token',
    stage: 'repository',
    type: 'string',
    admin: true,
  },
  {
    name: 'username',
    description: 'Username for authentication. Currently Bitbucket only',
    stage: 'repository',
    type: 'string',
    admin: true,
  },
  {
    name: 'password',
    description:
      'Password for authentication. Currently Bitbucket only (AppPassword).',
    stage: 'repository',
    type: 'string',
    admin: true,
  },
  {
    name: 'npmrc',
    description: 'String copy of npmrc file. Use \\n instead of line breaks',
    stage: 'branch',
    type: 'string',
  },
  {
    name: 'npmToken',
    description: 'npm token used for authenticating with the default registry',
    stage: 'branch',
    type: 'string',
  },
  {
    name: 'yarnrc',
    description: 'String copy of yarnrc file. Use \\n instead of line breaks',
    stage: 'branch',
    type: 'string',
  },
  {
    name: 'updateLockFiles',
    description: 'Set to false to disable lock file updating',
    type: 'boolean',
  },
  {
    name: 'skipInstalls',
    description:
      'Skip installing modules/dependencies if lock file updating is possible alone',
    type: 'boolean',
    default: null,
    admin: true,
  },
  {
    name: 'ignoreNpmrcFile',
    description: 'Whether to ignore any .npmrc file found in repository',
    stage: 'package',
    type: 'boolean',
    default: false,
  },
  {
    name: 'autodiscover',
    description: 'Autodiscover all repositories',
    stage: 'global',
    type: 'boolean',
    default: false,
  },
  {
    name: 'repositories',
    description: 'List of Repositories',
    stage: 'global',
    type: 'list',
    cli: false,
  },
  {
    name: 'baseBranches',
    description:
      'An array of one or more custom base branches to be processed. If left empty, the default branch will be chosen',
    type: 'list',
    stage: 'package',
    cli: false,
    env: false,
  },
  {
    name: 'gitAuthor',
    description: 'Author to use for git commits. RFC5322',
    type: 'string',
    admin: true,
  },
  {
    name: 'gitPrivateKey',
    description: 'PGP key to use for signing git commits',
    type: 'string',
    cli: false,
    admin: true,
  },
  {
    name: 'enabledManagers',
    description:
      'A list of package managers to enable. If defined, then all managers not on the list are disabled.',
    type: 'list',
    stage: 'repository',
  },
  {
    name: 'includePaths',
    description: 'Include package files only within these defined paths',
    type: 'list',
    stage: 'repository',
    default: [],
  },
  {
    name: 'ignorePaths',
    description:
      'Skip any package.json whose path matches one of these. Can be string or glob pattern',
    type: 'list',
    stage: 'repository',
    default: ['**/node_modules/**', '**/bower_components/**'],
  },
  {
    name: 'engines',
    description: 'Configuration specifically for `package.json`>`engines`',
    stage: 'package',
    type: 'json',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'registryUrls',
    description:
      'List of URLs to try for dependency lookup. Package manager-specific',
    type: 'list',
    default: null,
    stage: 'branch',
    cli: false,
    env: false,
  },
  {
    name: 'versionScheme',
    description: 'Version scheme to use for filtering and comparisons',
    type: 'string',
    allowedValues: [
      'cargo',
      'composer',
      'docker',
      'hashicorp',
      'loose',
      'maven',
      'node',
      'npm',
      'pep440',
      'ruby',
      'semver',
    ],
    default: 'semver',
    cli: false,
    env: false,
  },
  // depType
  {
    name: 'ignoreDeps',
    description: 'Dependencies to ignore',
    type: 'list',
    stage: 'package',
    mergeable: true,
  },
  {
    name: 'packageRules',
    description: 'Rules for matching package names',
    type: 'list',
    stage: 'package',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'languages',
    description:
      'List of languages to match (e.g. ["pipenv"]). Valid only within `packageRules` object',
    type: 'list',
    allowString: true,
    parent: 'packageRules',
    stage: 'package',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'managers',
    description:
      'List of package managers to match (e.g. ["pipenv"]). Valid only within `packageRules` object',
    type: 'list',
    allowString: true,
    parent: 'packageRules',
    stage: 'package',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'depTypeList',
    description:
      'List of depTypes to match (e.g. [`peerDependencies`]). Valid only within `packageRules` object',
    type: 'list',
    allowString: true,
    parent: 'packageRules',
    stage: 'package',
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
    stage: 'package',
    parent: 'packageRules',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'excludePackageNames',
    description:
      'Package names to exclude. Valid only within `packageRules` object',
    type: 'list',
    allowString: true,
    stage: 'package',
    parent: 'packageRules',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'packagePatterns',
    description:
      'Package name patterns to match. Valid only within `packageRules` object.',
    type: 'list',
    allowString: true,
    stage: 'package',
    parent: 'packageRules',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'excludePackagePatterns',
    description:
      'Package name patterns to exclude. Valid only within `packageRules` object.',
    type: 'list',
    allowString: true,
    stage: 'package',
    parent: 'packageRules',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'matchCurrentVersion',
    description:
      'A version or version range to match against the current version of a package. Valid only within `packageRules` object',
    type: 'string',
    stage: 'package',
    parent: 'packageRules',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'sourceUrlPrefixes',
    description:
      'A list of source URL prefixes to match against, commonly used for grouping of monorepos or packages from the same organization.',
    type: 'list',
    allowString: true,
    stage: 'package',
    parent: 'packageRules',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'updateTypes',
    description:
      'Update types to match against (major, minor, pin, etc). Valid only within `packageRules` object.',
    type: 'list',
    allowString: true,
    stage: 'package',
    parent: 'packageRules',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'paths',
    description:
      'List of strings or glob patterns to match against package files. Applicable inside packageRules only',
    type: 'list',
    stage: 'repository',
    parent: 'packageRules',
    cli: false,
    env: false,
  },
  // Version behaviour
  {
    name: 'allowedVersions',
    description: 'A semver range defining allowed versions for dependencies',
    type: 'string',
    parent: 'packageRules',
    stage: 'package',
    cli: false,
    env: false,
  },
  {
    name: 'pinDigests',
    description: 'Whether to add digests to Dockerfile source images',
    stage: 'package',
    type: 'boolean',
    default: false,
  },
  {
    name: 'separateMajorMinor',
    description:
      'If set to false, it will upgrade dependencies to latest release only, and not separate major/minor branches',
    type: 'boolean',
  },
  {
    name: 'separateMultipleMajor',
    description:
      'If set to true, PRs will be raised separately for each available major upgrade version',
    stage: 'package',
    type: 'boolean',
    default: false,
  },
  {
    name: 'separateMinorPatch',
    description:
      'If set to true, it will separate minor and patch updates into separate branches',
    type: 'boolean',
    default: false,
  },
  {
    name: 'ignoreUnstable',
    description: 'Ignore versions with unstable semver',
    stage: 'package',
    type: 'boolean',
  },
  {
    name: 'ignoreDeprecated',
    description:
      'Ignore deprecated versions unless the current version is deprecated',
    stage: 'package',
    type: 'boolean',
    default: true,
  },
  {
    name: 'unstablePattern',
    description: 'Regex for identifying unstable versions (docker only)',
    stage: 'package',
    type: 'string',
    cli: false,
    env: false,
  },
  {
    name: 'followTag',
    description: 'If defined, packages will follow this release tag exactly.',
    stage: 'package',
    type: 'string',
    cli: false,
    env: false,
  },
  {
    name: 'respectLatest',
    description: 'Ignore versions newer than npm "latest" version',
    stage: 'package',
    type: 'boolean',
  },
  {
    name: 'rangeStrategy',
    description: 'Policy for how to modify/update existing ranges.',
    type: 'string',
    default: 'replace',
    allowedValues: [
      'auto',
      'pin',
      'bump',
      'replace',
      'widen',
      'update-lockfile',
    ],
    cli: false,
    env: false,
  },
  {
    name: 'branchPrefix',
    description: 'Prefix to use for all branch names',
    stage: 'branch',
    type: 'string',
    default: `${appSlug}/`,
  },
  {
    name: 'bumpVersion',
    description: 'Bump the version in the package.json being updated',
    type: 'string',
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
      'Configuration to apply when an update type is patch. Only applies if `separateMinorPatch` is set to true',
    stage: 'package',
    type: 'json',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'pin',
    description: 'Configuration to apply when an update type is pin.',
    stage: 'package',
    type: 'json',
    default: {
      unpublishSafe: false,
      recreateClosed: true,
      rebaseStalePrs: true,
      groupName: 'Pin Dependencies',
      commitMessageAction: 'Pin',
      group: {
        commitMessageTopic: 'dependencies',
        commitMessageExtra: '',
      },
    },
    cli: false,
    mergeable: true,
  },
  {
    name: 'digest',
    description:
      'Configuration to apply when updating a digest (no change in tag/version)',
    stage: 'package',
    type: 'json',
    default: {
      branchTopic: '{{{depNameSanitized}}}-digest',
      commitMessageExtra: 'to {{newDigestShort}}',
      commitMessageTopic: '{{{depName}}} commit hash',
      prBodyDefinitions: {
        Change: '`{{{currentValue}}}` -> `{{{newDigestShort}}}`',
      },
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
    name: 'semanticCommitType',
    description: 'Commit type to use if semantic commits is enabled',
    type: 'string',
    default: 'chore',
  },
  {
    name: 'semanticCommitScope',
    description: 'Commit scope to use if semantic commits are enabled',
    type: 'string',
    default: 'deps',
  },
  // PR Behaviour
  {
    name: 'rollbackPrs',
    description:
      'Create PRs to roll back versions if the current version is not found in the registry',
    type: 'boolean',
    default: false,
  },
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
    default: null,
  },
  {
    name: 'rebaseLabel',
    description:
      'Label to use to request the bot to rebase a PR manually (GitHub only)',
    type: 'string',
    default: 'rebase',
  },
  {
    name: 'statusCheckVerify',
    description: 'Set a verify status check for all PRs',
    type: 'boolean',
    default: false,
  },
  {
    name: 'unpublishSafe',
    description: 'Set a status check for unpublish-safe upgrades',
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
  {
    name: 'prNotPendingHours',
    description: 'Timeout in hours for when prCreation=not-pending',
    type: 'integer',
    // Must be at least 24 hours to give time for the unpublishSafe check to "complete".
    default: 25,
  },
  {
    name: 'prHourlyLimit',
    description:
      'Rate limit PRs to maximum x created per hour. 0 (default) means no limit.',
    type: 'integer',
    default: 0, // no limit
  },
  {
    name: 'prConcurrentLimit',
    description:
      'Limit to a maximum of x concurrent branches/PRs. 0 (default) means no limit.',
    type: 'integer',
    default: 0, // no limit
  },
  // Automatic merging
  {
    name: 'automerge',
    description:
      'Whether to automerge branches/PRs automatically, without human intervention',
    type: 'boolean',
    default: false,
  },
  {
    name: 'automergeType',
    description:
      'How to automerge - "branch", "pr", or "pr-comment". Branch support is GitHub-only',
    type: 'string',
    default: 'pr',
  },
  {
    name: 'automergeComment',
    description:
      'PR comment to add to trigger automerge. Used only if automergeType=pr-comment',
    type: 'string',
    default: 'automergeComment',
  },
  {
    name: 'requiredStatusChecks',
    description:
      'List of status checks that must pass before automerging. Set to null to enable automerging without tests.',
    type: 'list',
    cli: false,
    env: false,
  },
  {
    name: 'vulnerabilityAlerts',
    description:
      'Config to apply when a PR is necessary due to vulnerability of existing package version.',
    type: 'object',
    default: {
      enabled: true,
      groupName: null,
      schedule: [],
      masterIssueApproval: false,
      commitMessageSuffix: '[SECURITY]',
    },
    cli: false,
    env: false,
  },
  // Default templates
  {
    name: 'branchName',
    description: 'Branch name template',
    type: 'string',
    default: '{{{branchPrefix}}}{{{managerBranchPrefix}}}{{{branchTopic}}}',
    cli: false,
  },
  {
    name: 'managerBranchPrefix',
    description: 'Branch manager prefix',
    type: 'string',
    default: '',
    cli: false,
  },
  {
    name: 'branchTopic',
    description: 'Branch topic',
    type: 'string',
    default:
      '{{{depNameSanitized}}}-{{{newMajor}}}{{#if isPatch}}.{{{newMinor}}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
    cli: false,
  },
  {
    name: 'commitMessage',
    description: 'Message to use for commit messages and pull request titles',
    type: 'string',
    default:
      '{{{commitMessagePrefix}}} {{{commitMessageAction}}} {{{commitMessageTopic}}} {{{commitMessageExtra}}} {{{commitMessageSuffix}}}',
    cli: false,
  },
  {
    name: 'commitBody',
    description:
      'Commit message body template. Will be appended to commit message, separated by two line returns.',
    type: 'string',
    cli: false,
  },
  {
    name: 'commitMessagePrefix',
    description:
      'Prefix to add to start of commit messages and PR titles. Uses a semantic prefix if semanticCommits enabled',
    type: 'string',
    cli: false,
  },
  {
    name: 'commitMessageAction',
    description: 'Action verb to use in commit messages and PR titles',
    type: 'string',
    default: 'Update',
    cli: false,
  },
  {
    name: 'commitMessageTopic',
    description: 'The upgrade topic/noun used in commit messages and PR titles',
    type: 'string',
    default: 'dependency {{depName}}',
    cli: false,
  },
  {
    name: 'commitMessageExtra',
    description:
      'Extra description used after the commit message topic - typically the version',
    type: 'string',
    default:
      'to {{#if isMajor}}v{{{newMajor}}}{{else}}{{#if isSingleVersion}}v{{{toVersion}}}{{else}}{{{newValue}}}{{/if}}{{/if}}',
    cli: false,
  },
  {
    name: 'commitMessageSuffix',
    description: 'Suffix to add to end of commit messages and PR titles.',
    type: 'string',
    cli: false,
  },
  {
    name: 'prTitle',
    description:
      'Pull Request title template (deprecated). Now uses commitMessage.',
    type: 'string',
    default: null,
    cli: false,
  },
  {
    name: 'prFooter',
    description: 'Pull Request footer template',
    type: 'string',
    default: `This PR has been generated by [${appName} Bot](${
      urls.homepage
    }).`,
    stage: 'global',
  },
  {
    name: 'lockFileMaintenance',
    description: 'Configuration for lock file maintenance',
    stage: 'branch',
    type: 'json',
    default: {
      enabled: false,
      recreateClosed: true,
      rebaseStalePrs: true,
      branchTopic: 'lock-file-maintenance',
      commitMessageAction: 'Lock file maintenance',
      commitMessageTopic: null,
      commitMessageExtra: null,
      schedule: ['before 5am on monday'],
      groupName: null,
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
      branchTopic: '{{{groupSlug}}}',
      commitMessageTopic: '{{{groupName}}}',
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
    description:
      'Assignees for Pull Request (username in GitHub/GitLab, email address in Azure DevOps)',
    type: 'list',
  },
  {
    name: 'reviewers',
    description:
      'Requested reviewers for Pull Requests (username in GitHub/GitLab, email or username in Azure DevOps)',
    type: 'list',
  },
  {
    name: 'fileMatch',
    description: 'JS RegExp pattern for matching manager files',
    type: 'list',
    stage: 'repository',
    allowString: true,
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'js',
    description: 'Configuration object for javascript language',
    stage: 'package',
    type: 'json',
    default: {},
    mergeable: true,
  },
  {
    name: 'npm',
    description: 'Configuration object for npm package.json renovation',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/)package.json$'],
      rollbackPrs: true,
      versionScheme: 'npm',
    },
    mergeable: true,
  },
  {
    name: 'meteor',
    description: 'Configuration object for meteor package.js renovation',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/)package.js$'],
    },
    mergeable: true,
  },
  {
    name: 'bazel',
    description: 'Configuration object for bazel WORKSPACE renovation',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/)WORKSPACE$'],
      prBodyDefinitions: {
        Change:
          '{{#if currentDigestShort}}`{{{currentDigestShort}}}` -> {{#if isDigest}}`{{{newDigestShort}}}`{{else}}`{{{newVersion}}}`{{/if}}{{else}}`{{{currentValue}}}` -> `{{{newValue}}}`{{/if}}',
      },
    },
    mergeable: true,
  },
  {
    name: 'buildkite',
    description: 'Configuration object for buildkite pipeline renovation',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['buildkite\\.ya?ml', '\\.buildkite/.+\\.ya?ml$'],
      commitMessageTopic: 'buildkite plugin {{depName}}',
      commitMessageExtra:
        'to {{#if isMajor}}v{{{newMajor}}}{{else}}{{{newValue}}}{{/if}}',
      managerBranchPrefix: 'buildkite-',
    },
    mergeable: true,
  },
  {
    name: 'golang',
    description: 'Configuration object for Go language',
    stage: 'package',
    type: 'json',
    default: {
      commitMessageTopic: 'module {{depNameShort}}',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'gomod',
    description: 'Configuration object for Go modules renovation',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/)go.mod$'],
      ignorePath: ['**/vendor/**'],
    },
    mergeable: true,
  },
  {
    name: 'ruby',
    releaseStatus: 'alpha',
    description: 'Configuration object for ruby language',
    stage: 'package',
    type: 'json',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'bundler',
    releaseStatus: 'alpha',
    description: 'Configuration object for bundler Gemfiles',
    stage: 'package',
    type: 'json',
    default: {
      enabled: false,
      fileMatch: ['(^|/)Gemfile$'],
      versionScheme: 'ruby',
      ignorePath: ['**/.cache/**'],
    },
    mergeable: true,
  },
  {
    name: 'terraform',
    description: 'Configuration object for Terraform module renovation',
    stage: 'repository',
    type: 'json',
    default: {
      commitMessageTopic: 'Terraform module {{depNameShort}}',
      fileMatch: ['\\.tf$'],
      versionScheme: 'hashicorp',
    },
    mergeable: true,
  },
  {
    name: 'rust',
    releaseStatus: 'unpublished',
    description: 'Configuration option for Rust package management.',
    stage: 'package',
    type: 'json',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'cargo',
    releaseStatus: 'unpublished',
    description: 'Configuration object for Cargo crate renovation.',
    stage: 'repository',
    type: 'json',
    default: {
      enabled: false,
      commitMessageTopic: 'Rust crate {{depName}}',
      managerBranchPrefix: 'rust-',
    },
    mergeable: true,
  },
  {
    name: 'supportPolicy',
    description:
      'Dependency support policy, e.g. used for LTS vs non-LTS etc (node-only)',
    type: 'list',
    stage: 'package',
    allowString: true,
  },
  {
    name: 'node',
    description: 'Configuration object for node version renovation',
    stage: 'package',
    type: 'json',
    default: {
      commitMessageTopic: 'Node.js',
      major: {
        enabled: false,
      },
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'travis',
    description: 'Configuration object for .travis.yml node version renovation',
    stage: 'package',
    type: 'json',
    default: {
      enabled: false,
      fileMatch: ['^.travis.yml$'],
      versionScheme: 'node',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'nvm',
    description: 'Configuration object for .nvmrc files',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['^.nvmrc$'],
      versionScheme: 'node',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'docker',
    description: 'Configuration object for Docker language',
    stage: 'package',
    type: 'json',
    default: {
      versionScheme: 'docker',
      managerBranchPrefix: 'docker-',
      commitMessageTopic: '{{{depName}}} Docker tag',
      major: { enabled: false },
      commitMessageExtra:
        'to v{{#if isMajor}}{{{newMajor}}}{{else}}{{{newVersion}}}{{/if}}',
      digest: {
        branchTopic: '{{{depNameSanitized}}}-{{{currentValue}}}',
        commitMessageExtra: 'to {{newDigestShort}}',
        commitMessageTopic:
          '{{{depName}}}{{#if currentValue}}:{{{currentValue}}}{{/if}} Docker digest',
        group: {
          commitMessageTopic: '{{{groupName}}}',
          commitMessageExtra: '',
        },
      },
      pin: {
        commitMessageExtra: '',
        groupName: 'Docker digests',
        group: {
          commitMessageTopic: '{{{groupName}}}',
          branchTopic: 'digests-pin',
        },
      },
      group: {
        commitMessageTopic: '{{{groupName}}} Docker tags',
      },
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'docker-compose',
    description:
      'Configuration object for Docker Compose renovation. Also inherits settings from `docker` object.',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/)docker-compose[^/]*\\.ya?ml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'dockerfile',
    description: 'Configuration object for Dockerfile renovation',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/)Dockerfile$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'kubernetes',
    description:
      'Configuration object for Kubernetes renovation. Also inherits settings from `docker` object.',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: [],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'circleci',
    description:
      'Configuration object for CircleCI yml renovation. Also inherits settings from `docker` object.',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/).circleci/config.yml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'ansible',
    description:
      'Configuration object for Ansible yaml renovation. Also inherits settings from `docker` object.',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/)tasks/[^/]+\\.ya?ml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'composer',
    description: 'Configuration object for composer.json files',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/)([\\w-]*)composer.json$'],
      versionScheme: 'composer',
      ignorePath: ['**/vendor/**'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'php',
    description: 'Configuration object for php',
    stage: 'package',
    type: 'json',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'pip_requirements',
    description: 'Configuration object for requirements.txt files',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/)([\\w-]*)requirements.(txt|pip)$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'pip_setup',
    releaseStatus: 'beta',
    description: 'Configuration object for setup.py files',
    stage: 'package',
    type: 'json',
    default: {
      enabled: false,
      fileMatch: ['(^|/)setup.py$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'pipenv',
    releaseStatus: 'beta',
    description: 'Configuration object for Pipfile files',
    stage: 'package',
    type: 'json',
    default: {
      enabled: false,
      fileMatch: ['(^|/)Pipfile$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'python',
    description: 'Configuration object for python',
    stage: 'package',
    type: 'json',
    default: {
      versionScheme: 'pep440',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'compatibility',
    description: 'Configuration object for compatibility',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'java',
    description: 'Configuration object for all Java package managers',
    stage: 'package',
    type: 'json',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'gradle',
    releaseStatus: 'beta',
    description: 'Configuration object for build.gradle files',
    stage: 'package',
    type: 'json',
    default: {
      enabled: false,
      fileMatch: ['\\.gradle$', '(^|/)gradle.properties$'],
      timeout: 300,
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'gradle-wrapper',
    description: 'Configuration object for gradle-wrapper.properties files',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['(^|/)gradle/wrapper/gradle-wrapper.properties$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'maven',
    description: 'Configuration object for when renovating Maven pom.xml files',
    releaseStatus: 'alpha',
    stage: 'package',
    type: 'json',
    default: {
      enabled: false,
      fileMatch: ['\\.pom.xml$', '(^|/)pom.xml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'gitlabci',
    description:
      'Configuration object for GitLab CI yml renovation. Also inherits settings from `docker` object.',
    stage: 'repository',
    type: 'json',
    default: {
      fileMatch: ['^\\.gitlab-ci\\.yml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'nuget',
    description: 'Configuration object for C#/Nuget',
    stage: 'package',
    type: 'json',
    default: {
      fileMatch: ['\\.csproj$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'hostRules',
    description: 'Host rules/configuration including credentials',
    type: 'list',
    stage: 'repository',
    cli: true,
    mergeable: true,
  },
  {
    name: 'prBodyDefinitions',
    description: 'Table column definitions for use in PR tables',
    type: 'object',
    mergeable: true,
    default: {
      Package: '{{{depName}}}',
      Type: '{{{depType}}}',
      Update: '{{{updateType}}}',
      'Current value': '{{{currentValue}}}',
      'New value': '{{{newValue}}}',
      Change:
        '{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}',
      References: '{{{references}}}',
      'Package file': '{{{packageFile}}}',
    },
  },
  {
    name: 'prBodyColumns',
    description: 'List of columns to use in PR bodies',
    type: 'list',
    default: ['Package', 'Type', 'Update', 'Change', 'References'],
  },
  {
    name: 'prBodyNotes',
    description:
      'List of additional notes/templates to be included in the Pull Request bodies.',
    type: 'list',
    default: [],
    allowString: true,
    mergeable: true,
  },
  {
    name: 'suppressNotifications',
    description:
      'Options to suppress various types of warnings and other notifications',
    type: 'list',
    default: [],
    allowedValues: [
      'prIgnoreNotification',
      'prEditNotification',
      'branchAutomergeFailure',
      'lockFileErrors',
      'deprecationWarningIssues',
      'onboardingClose',
    ],
    cli: false,
    env: false,
    mergeable: true,
  },
];

function getOptions() {
  return options;
}
