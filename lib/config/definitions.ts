import { RenovateConfigStage } from './common';

export interface RenovateOptionBase {
  admin?: boolean;

  allowedValues?: string[];

  allowString?: boolean;

  cli?: boolean;

  description: string;

  env?: false | string;

  freeChoice?: boolean;
  mergeable?: boolean;

  name: string;

  parent?: 'hostRules' | 'packageRules';

  // used by tests
  relatedOptions?: string[];

  releaseStatus?: 'alpha' | 'beta' | 'unpublished';

  stage?: RenovateConfigStage;
}

export interface RenovateArrayOption<T extends string | object = any>
  extends RenovateOptionBase {
  default?: T;
  mergeable?: boolean;
  type: 'array';
}

export interface RenovateStringArrayOption extends RenovateArrayOption<string> {
  format?: 'regex';
  subType: 'string' | 'object';
}

export interface RenovateBooleanOption extends RenovateOptionBase {
  default?: boolean;
  type: 'boolean';
}

export interface RenovateIntegerOption extends RenovateOptionBase {
  default?: number;
  type: 'integer';
}

export interface RenovateStringOption extends RenovateOptionBase {
  default?: string;
  format?: 'regex';

  // Not used
  replaceLineReturns?: boolean;
  type: 'string';
}

export interface RenovateObjectOption extends RenovateOptionBase {
  default?: any;
  additionalProperties?: {} | boolean;
  mergeable?: boolean;
  type: 'object';
}

export type RenovateOptions =
  | RenovateStringOption
  | RenovateStringArrayOption
  | RenovateIntegerOption
  | RenovateBooleanOption
  | RenovateArrayOption
  | RenovateObjectOption;

const options: RenovateOptions[] = [
  {
    name: 'onboardingBranch',
    description:
      'Change this value in order to override the default onboarding branch name.',
    type: 'string',
    default: 'renovate/configure',
    admin: true,
    cli: false,
  },
  {
    name: 'onboardingPrTitle',
    description:
      'Change this value in order to override the default onboarding PR title.',
    type: 'string',
    default: 'Configure Renovate',
    admin: true,
    cli: false,
  },
  {
    name: 'productLinks',
    description: 'Links which are embedded within PRs, issues, etc',
    type: 'object',
    admin: true,
    mergeable: true,
    default: {
      documentation: 'https://docs.renovatebot.com/',
      help: 'https://github.com/renovatebot/config-help/issues',
      homepage: 'https://github.com/renovatebot/renovate',
    },
    additionalProperties: {
      type: 'string',
      format: 'uri',
    },
  },
  {
    name: 'extends',
    description:
      'Configuration presets to use/extend. Note: does not work if configured in config.js',
    stage: 'package',
    type: 'array',
    subType: 'string',
    allowString: true,
    cli: false,
  },
  {
    name: 'ignorePresets',
    description:
      'A list of presets to ignore, including nested ones inside `extends`',
    stage: 'package',
    type: 'array',
    subType: 'string',
    allowString: true,
    cli: false,
  },
  {
    name: 'description',
    description: 'Plain text description for a config or preset',
    type: 'array',
    subType: 'string',
    stage: 'repository',
    allowString: true,
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'enabled',
    description: `Enable or disable the bot`,
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
    type: 'object',
    cli: false,
    env: false,
  },
  {
    name: 'forceCli',
    description:
      'Whether CLI configuration options should be moved to the `force` config section',
    stage: 'global',
    type: 'boolean',
    default: true,
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
      'Where to source binaries like `npm` and `yarn` from, choices are `auto`, `global` and `docker`',
    admin: true,
    type: 'string',
    default: 'auto',
  },
  {
    name: 'baseDir',
    description:
      'The base directory for Renovate to store local files, including repository files and cache. If left empty, Renovate will create its own temporary directory to use.',
    admin: true,
    type: 'string',
  },
  {
    name: 'cacheDir',
    description:
      'The directory for Renovate for storing caches. If left empty, Renovate will create a subdirectory within `baseDir` to use.',
    admin: true,
    type: 'string',
  },
  {
    name: 'dockerMapDotfiles',
    description:
      'Map relevant home directory dotfiles into containers when binarySource=docker.',
    admin: true,
    type: 'boolean',
    default: false,
  },
  {
    name: 'dockerUser',
    description:
      'Specify UID and GID for docker-based binaries when binarySource=docker is used.',
    admin: true,
    type: 'string',
  },
  // Log options
  {
    name: 'logLevel',
    description: 'Logging level',
    stage: 'global',
    type: 'string',
    allowedValues: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
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
    type: 'object',
    default: {},
    admin: true,
    mergeable: true,
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
    default: true,
    admin: true,
  },
  {
    name: 'optimizeForDisabled',
    description:
      'Set to true to first check for disabling in config before cloning',
    stage: 'repository',
    type: 'boolean',
    default: false,
    admin: true,
  },
  // Master Issue
  {
    name: 'masterIssue',
    description: 'Whether to create a "Master Issue" within the repository.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'masterIssueApproval',
    description:
      'Whether updates should require manual approval from within the Master Issue before creation.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'masterIssueAutoclose',
    description:
      'Set to `true` and Renovate will autoclose the Master Issue if there are no updates.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'masterIssueTitle',
    description: 'Title to use for the Master Issue',
    type: 'string',
    default: `Update Dependencies (Renovate Bot)`,
  },
  {
    name: 'configWarningReuseIssue',
    description:
      'Set this to false and Renovate will open each config warning in a new issue instead of reopening/reusing an existing issue.',
    type: 'boolean',
    default: true,
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
    type: 'object',
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
    type: 'array',
    subType: 'string',
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
    name: 'persistRepoData',
    description:
      'If set to true, repository data will preserved between runs instead of deleted.',
    type: 'boolean',
    admin: true,
    default: false,
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
    name: 'ignoreScripts',
    description:
      'Configure this to true if trustLevel is high but you wish to skip running scripts when updating lock files',
    stage: 'package',
    type: 'boolean',
    default: false,
  },
  {
    name: 'platform',
    description: 'Platform type of repository',
    type: 'string',
    allowedValues: [
      'azure',
      'bitbucket',
      'bitbucket-server',
      'github',
      'gitlab',
    ],
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
    name: 'autodiscoverFilter',
    description: 'Filter the list of autodiscovered repositories',
    stage: 'global',
    type: 'string',
    default: null,
  },
  {
    name: 'prCommitsPerRunLimit',
    description:
      'Set a maximum number of commits per Renovate run. Default is no limit.',
    stage: 'global',
    type: 'integer',
    default: 0,
  },
  {
    name: 'repositories',
    description: 'List of Repositories',
    stage: 'global',
    type: 'array',
    cli: false,
  },
  {
    name: 'baseBranches',
    description:
      'An array of one or more custom base branches to be processed. If left empty, the default branch will be chosen',
    type: 'array',
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
    type: 'array',
    stage: 'repository',
  },
  {
    name: 'includePaths',
    description: 'Include package files only within these defined paths',
    type: 'array',
    subType: 'string',
    stage: 'repository',
    default: [],
  },
  {
    name: 'ignorePaths',
    description:
      'Skip any package file whose path matches one of these. Can be string or glob pattern',
    type: 'array',
    subType: 'string',
    stage: 'repository',
    default: ['**/node_modules/**', '**/bower_components/**'],
  },
  {
    name: 'excludeCommitPaths',
    description:
      'A file that matches any of these glob patterns will not be committed, even if it has been updated.',
    type: 'array',
    subType: 'string',
    default: [],
  },
  {
    name: 'engines',
    description: 'Configuration specifically for `package.json`>`engines`',
    stage: 'package',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'aliases',
    description: 'Aliases for registries, package manager specific',
    type: 'object',
    default: {},
    additionalProperties: {
      type: 'string',
      format: 'uri',
    },
  },
  {
    name: 'registryUrls',
    description:
      'List of URLs to try for dependency lookup. Package manager-specific',
    type: 'array',
    subType: 'string',
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
      'git',
      'hashicorp',
      'hex',
      'ivy',
      'loose',
      'maven',
      'node',
      'npm',
      'nuget',
      'pep440',
      'poetry',
      'regex',
      'ruby',
      'semver',
      'swift',
    ],
    default: 'semver',
    cli: false,
    env: false,
  },
  {
    name: 'azureAutoComplete',
    description:
      'If set to true, Azure DevOps PRs will be set to auto-complete after all (if any) branch policies have been met',
    type: 'boolean',
    default: false,
  },
  {
    name: 'azureWorkItemId',
    description:
      'The id of an existing work item on Azure Boards to link to each PR',
    type: 'integer',
    default: 0,
  },
  // depType
  {
    name: 'ignoreDeps',
    description: 'Dependencies to ignore',
    type: 'array',
    subType: 'string',
    stage: 'package',
    mergeable: true,
  },
  {
    name: 'packageRules',
    description: 'Rules for matching package names',
    type: 'array',
    stage: 'package',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'languages',
    description:
      'List of languages to match (e.g. ["python"]). Valid only within `packageRules` object',
    type: 'array',
    subType: 'string',
    allowString: true,
    parent: 'packageRules',
    stage: 'package',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'baseBranchList',
    description:
      'List of branches to match (e.g. ["master"]). Valid only within `packageRules` object',
    type: 'array',
    subType: 'string',
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
    type: 'array',
    subType: 'string',
    allowString: true,
    parent: 'packageRules',
    stage: 'package',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'datasources',
    description:
      'List of datasources to match (e.g. ["orb"]). Valid only within `packageRules` object',
    type: 'array',
    subType: 'string',
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
    type: 'array',
    subType: 'string',
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
    type: 'array',
    subType: 'string',
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
    type: 'array',
    subType: 'string',
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
    type: 'array',
    subType: 'string',
    format: 'regex',
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
    type: 'array',
    subType: 'string',
    format: 'regex',
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
    type: 'array',
    subType: 'string',
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
    type: 'array',
    // TODO: add allowedValues
    subType: 'string',
    allowedValues: [
      'major',
      'minor',
      'patch',
      'pin',
      'digest',
      'lockFileMaintenance',
      'rollback',
      'bump',
    ],
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
    type: 'array',
    subType: 'string',
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
    default: `renovate/`,
  },
  {
    name: 'bumpVersion',
    description: 'Bump the version in the package.json being updated',
    type: 'string',
    allowedValues: ['major', 'minor', 'patch'],
  },
  // Major/Minor/Patch
  {
    name: 'major',
    description: 'Configuration to apply when an update type is major',
    stage: 'package',
    type: 'object',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'minor',
    description: 'Configuration to apply when an update type is minor',
    stage: 'package',
    type: 'object',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'patch',
    description:
      'Configuration to apply when an update type is patch. Only applies if `separateMinorPatch` is set to true',
    stage: 'package',
    type: 'object',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'pin',
    description: 'Configuration to apply when an update type is pin.',
    stage: 'package',
    type: 'object',
    default: {
      unpublishSafe: false,
      recreateClosed: true,
      rebaseStalePrs: true,
      groupName: 'Pin Dependencies',
      groupSlug: 'pin-dependencies',
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
    type: 'object',
    default: {
      branchTopic: '{{{depNameSanitized}}}-digest',
      commitMessageExtra: 'to {{newDigestShort}}',
      commitMessageTopic: '{{{depName}}} commit hash',
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
    name: 'rebaseConflictedPrs',
    description: 'Auto-rebase when there is conflict in PRs',
    type: 'boolean',
    default: true,
  },
  {
    name: 'rebaseStalePrs',
    description: 'Rebase any PRs that are not up-to-date with the base branch',
    type: 'boolean',
    default: null,
  },
  {
    name: 'rebaseLabel',
    description: 'Label to use to request the bot to rebase a PR manually',
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
    name: 'stabilityDays',
    description:
      'Number of days required before a new release is considered to be stabilized.',
    type: 'integer',
    default: 0,
  },
  {
    name: 'prCreation',
    description: 'When to create the PR for a branch.',
    type: 'string',
    allowedValues: ['immediate', 'not-pending', 'status-success', 'approval'],
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
  {
    name: 'prPriority',
    description:
      'Set sorting priority for PR creation. PRs with higher priority are created first, negative priority last.',
    type: 'integer',
    default: 0,
    cli: false,
    env: false,
  },
  {
    name: 'bbUseDefaultReviewers',
    description: 'Use the default reviewers (Bitbucket only).',
    type: 'boolean',
    default: true,
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
    description: 'How to automerge, if enabled.',
    type: 'string',
    allowedValues: ['branch', 'pr', 'pr-comment'],
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
    type: 'array',
    subType: 'string',
    cli: false,
    env: false,
  },
  {
    name: 'vulnerabilityAlerts',
    description:
      'Config to apply when a PR is necessary due to vulnerability of existing package version.',
    type: 'object',
    default: {
      groupName: null,
      schedule: [],
      masterIssueApproval: false,
      rangeStrategy: 'update-lockfile',
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
    name: 'commitBodyTable',
    description:
      'If enabled, append a table in the commit message body describing all updates in the commit',
    type: 'boolean',
    default: false,
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
    default: `This PR has been generated by [Renovate Bot](https://github.com/renovatebot/renovate).`,
    stage: 'global',
  },
  {
    name: 'lockFileMaintenance',
    description: 'Configuration for lock file maintenance',
    stage: 'branch',
    type: 'object',
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
      prBodyDefinitions: {
        Change: 'All locks refreshed',
      },
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
    type: 'object',
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
    type: 'array',
    subType: 'string',
  },
  {
    name: 'assignees',
    description:
      'Assignees for Pull Request (either username or email address depending on the platform)',
    type: 'array',
    subType: 'string',
  },
  {
    name: 'assigneesSampleSize',
    description: 'Take a random sample of given size from assignees.',
    type: 'integer',
    default: null,
  },
  {
    name: 'assignAutomerge',
    description:
      'Assign reviewers and assignees even if the PR is to be automerged',
    type: 'boolean',
    default: false,
  },
  {
    name: 'reviewers',
    description:
      'Requested reviewers for Pull Requests (either username or email address depending on the platform)',
    type: 'array',
    subType: 'string',
  },
  {
    name: 'reviewersSampleSize',
    description: 'Take a random sample of given size from reviewers.',
    type: 'integer',
    default: null,
  },
  {
    name: 'fileMatch',
    description: 'RegEx (re2) pattern for matching manager files',
    type: 'array',
    subType: 'string',
    format: 'regex',
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
    type: 'object',
    default: {},
    mergeable: true,
  },
  {
    name: 'npm',
    description: 'Configuration object for npm package.json renovation',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)package.json$'],
      rollbackPrs: true,
      versionScheme: 'npm',
      prBodyDefinitions: {
        Change:
          '[{{#if displayFrom}}`{{{displayFrom}}}` -> {{else}}{{#if currentValue}}`{{{currentValue}}}` -> {{/if}}{{/if}}{{#if displayTo}}`{{{displayTo}}}`{{else}}`{{{newValue}}}`{{/if}}](https://renovatebot.com/diffs/npm/{{{depNameEscaped}}}/{{{fromVersion}}}/{{{toVersion}}})',
      },
    },
    mergeable: true,
  },
  {
    name: 'meteor',
    description: 'Configuration object for meteor package.js renovation',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)package.js$'],
    },
    mergeable: true,
  },
  {
    name: 'bazel',
    description: 'Configuration object for bazel WORKSPACE renovation',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)WORKSPACE$', '\\.bzl$'],
    },
    mergeable: true,
  },
  {
    name: 'buildkite',
    description: 'Configuration object for buildkite pipeline renovation',
    stage: 'package',
    type: 'object',
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
    type: 'object',
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
    type: 'object',
    default: {
      fileMatch: ['(^|/)go.mod$'],
    },
    mergeable: true,
  },
  {
    name: 'postUpdateOptions',
    description:
      'Enable post-update options to be run after package/artifact updating',
    type: 'array',
    default: [],
    allowedValues: [
      'gomodTidy',
      'npmDedupe',
      'yarnDedupeFewer',
      'yarnDedupeHighest',
    ],
    cli: false,
    env: false,
    mergeable: true,
  },
  {
    name: 'ruby',
    description: 'Configuration object for ruby language',
    stage: 'package',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'bundler',
    description: 'Configuration object for bundler Gemfiles',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)Gemfile$'],
      versionScheme: 'ruby',
    },
    mergeable: true,
  },
  {
    name: 'ruby-version',
    description: 'Configuration object for .ruby-version updating',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)\\.ruby-version$'],
      versionScheme: 'ruby',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'terraform',
    description: 'Configuration object for Terraform dependencies renovation',
    stage: 'repository',
    type: 'object',
    default: {
      commitMessageTopic:
        'Terraform {{managerData.terraformDependencyType}} {{depNameShort}}',
      fileMatch: ['\\.tf$'],
      versionScheme: 'hashicorp',
    },
    mergeable: true,
  },
  {
    name: 'mix',
    description: 'Configuration object for Mix module renovation',
    stage: 'repository',
    type: 'object',
    default: {
      fileMatch: ['(^|/)mix\\.exs$'],
      versionScheme: 'hex',
    },
    mergeable: true,
  },
  {
    name: 'rust',
    description: 'Configuration option for Rust package management.',
    stage: 'package',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'cargo',
    description: 'Configuration object for Cargo crate renovation.',
    stage: 'repository',
    type: 'object',
    default: {
      commitMessageTopic: 'Rust crate {{depName}}',
      managerBranchPrefix: 'rust-',
      fileMatch: ['(^|/)Cargo.toml$'],
      versionScheme: 'cargo',
      rangeStrategy: 'bump',
    },
    mergeable: true,
  },
  {
    name: 'supportPolicy',
    description:
      'Dependency support policy, e.g. used for LTS vs non-LTS etc (node-only)',
    type: 'array',
    subType: 'string',
    stage: 'package',
    allowString: true,
  },
  {
    name: 'node',
    description: 'Configuration object for node version renovation',
    stage: 'package',
    type: 'object',
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
    type: 'object',
    default: {
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
    type: 'object',
    default: {
      fileMatch: ['^.nvmrc$'],
      versionScheme: 'node',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'pub',
    description: 'Configuration object for when renovating Dart pubspec files',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)pubspec\\.ya?ml$'],
      versionScheme: 'npm',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'docker',
    description: 'Configuration object for Docker language',
    stage: 'package',
    type: 'object',
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
    type: 'object',
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
    type: 'object',
    default: {
      fileMatch: ['(^|/)Dockerfile$', '(^|/)Dockerfile\\.[^/]*$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'kubernetes',
    description:
      'Configuration object for Kubernetes renovation. Also inherits settings from `docker` object.',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: [],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'helm-requirements',
    description: 'Configuration object for helm requirements.yaml files.',
    stage: 'package',
    type: 'object',
    default: {
      aliases: {
        stable: 'https://kubernetes-charts.storage.googleapis.com/',
      },
      commitMessageTopic: 'helm chart {{depName}}',
      fileMatch: ['(^|/)requirements.yaml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'circleci',
    description:
      'Configuration object for CircleCI yml renovation. Also inherits settings from `docker` object.',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/).circleci/config.yml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'droneci',
    description:
      'Configuration object for DroneCI yml renovation. Also inherits settings from `docker` object.',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/).drone.yml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'ansible',
    description:
      'Configuration object for Ansible yaml renovation. Also inherits settings from `docker` object.',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)tasks/[^/]+\\.ya?ml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'github-actions',
    description:
      'Configuration object for GitHub Actions workflow renovation. Also inherits settings from `docker` object.',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: [
        '^\\.github/main.workflow$',
        '^\\.github/workflows/[^/]+\\.ya?ml$',
      ],
      pinDigests: true,
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'composer',
    description: 'Configuration object for composer.json files',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)([\\w-]*)composer.json$'],
      versionScheme: 'composer',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'git-submodules',
    description: 'Configuration object for git submodule files',
    stage: 'package',
    type: 'object',
    default: {
      enabled: false,
      versionScheme: 'git',
      fileMatch: ['(^|/).gitmodules$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'php',
    description: 'Configuration object for php',
    stage: 'package',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'pip_requirements',
    description: 'Configuration object for requirements.txt files',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)([\\w-]*)requirements.(txt|pip)$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'pip_setup',
    description: 'Configuration object for setup.py files',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)setup.py$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'pipenv',
    description: 'Configuration object for Pipfile files',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)Pipfile$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'poetry',
    description: 'Configuration object for pyproject.toml files',
    stage: 'package',
    type: 'object',
    default: {
      versionScheme: 'poetry',
      fileMatch: ['(^|/)pyproject\\.toml$'],
    },
    mergeable: true,
  },
  {
    name: 'python',
    description: 'Configuration object for python',
    stage: 'package',
    type: 'object',
    default: {
      versionScheme: 'pep440',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'sbt',
    description: 'Configuration object for *.sbt files',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['\\.sbt$'],
      timeout: 300,
      versionScheme: 'ivy',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'leiningen',
    description:
      'Configuration object for renovating Clojure leiningen projects',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)project\\.clj$'],
      versionScheme: 'maven',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'deps-edn',
    description:
      'Configuration object for renovating Clojure CLI-based projects (deps.edn)',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)deps\\.edn$'],
      versionScheme: 'maven',
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
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'gradle',
    description: 'Configuration object for build.gradle files',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['\\.gradle(\\.kts)?$', '(^|/)gradle.properties$'],
      timeout: 600,
      versionScheme: 'maven',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'gradle-wrapper',
    description: 'Configuration object for gradle-wrapper.properties files',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)gradle/wrapper/gradle-wrapper.properties$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'maven',
    description: 'Configuration object for when renovating Maven pom.xml files',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['\\.pom\\.xml$', '(^|/)pom\\.xml$'],
      versionScheme: 'maven',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'gitlabci',
    description:
      'Configuration object for GitLab CI yml renovation. Also inherits settings from `docker` object.',
    stage: 'repository',
    type: 'object',
    default: {
      fileMatch: ['^\\.gitlab-ci\\.yml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'gitlabci-include',
    description:
      'Configuration object for GitLab CI yml renovation for include.',
    stage: 'repository',
    type: 'object',
    default: {
      fileMatch: ['^\\.gitlab-ci\\.yml$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'dotnet',
    description: 'Configuration object for .NET language',
    stage: 'package',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'nuget',
    description: 'Configuration object for C#/Nuget',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['\\.csproj$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'homebrew',
    description: 'Configuration object for homebrew',
    stage: 'package',
    type: 'object',
    default: {
      commitMessageTopic: 'Homebrew Formula {{depName}}',
      managerBranchPrefix: 'homebrew-',
      fileMatch: ['^Formula/[^/]+[.]rb$'],
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'hostRules',
    description: 'Host rules/configuration including credentials',
    type: 'array',
    subType: 'object',
    default: [
      {
        timeout: 60000,
      },
    ],
    stage: 'repository',
    cli: true,
    mergeable: true,
  },
  {
    name: 'hostType',
    description:
      'hostType for a package rule. Can be a platform name or a datasource name',
    type: 'string',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'domainName',
    description: 'Domain name for a host rule. e.g. "docker.io"',
    type: 'string',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'hostName',
    description: 'Hostname for a host rule. e.g. "index.docker.io"',
    type: 'string',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'baseUrl',
    description: 'baseUrl for a host rule. e.g. "https://api.github.com/"',
    type: 'string',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'timeout',
    description: 'timeout (in milliseconds) for queries to external endpoints',
    type: 'integer',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'insecureRegistry',
    description: 'explicity turn on insecure docker registry access (http)',
    type: 'boolean',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'prBodyDefinitions',
    description: 'Table column definitions for use in PR tables',
    type: 'object',
    freeChoice: true,
    mergeable: true,
    default: {
      Package: '{{{depNameLinked}}}',
      Type: '{{{depType}}}',
      Update: '{{{updateType}}}',
      'Current value': '{{{currentValue}}}',
      'New value': '{{{newValue}}}',
      Change: '`{{{displayFrom}}}` -> `{{{displayTo}}}`',
      References: '{{{references}}}',
      'Package file': '{{{packageFile}}}',
    },
  },
  {
    name: 'prBodyColumns',
    description: 'List of columns to use in PR bodies',
    type: 'array',
    default: ['Package', 'Type', 'Update', 'Change'],
  },
  {
    name: 'prBodyNotes',
    description:
      'List of additional notes/templates to be included in the Pull Request bodies.',
    type: 'array',
    subType: 'string',
    default: [],
    allowString: true,
    mergeable: true,
  },
  {
    name: 'suppressNotifications',
    description:
      'Options to suppress various types of warnings and other notifications',
    type: 'array',
    default: ['deprecationWarningIssues'],
    allowedValues: [
      'prIgnoreNotification',
      'prEditNotification',
      'branchAutomergeFailure',
      'lockFileErrors',
      'artifactErrors',
      'deprecationWarningIssues',
      'onboardingClose',
      'prValidation',
    ],
    cli: false,
    env: false,
    mergeable: true,
  },
  {
    name: 'swift',
    description: 'Configuration for Package.swift files',
    stage: 'package',
    type: 'object',
    default: {
      fileMatch: ['(^|/)Package\\.swift'],
      versionScheme: 'swift',
      rangeStrategy: 'bump',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'pruneStaleBranches',
    description: `Enable or disable pruning of stale branches`,
    type: 'boolean',
    default: true,
  },
  {
    name: 'unicodeEmoji',
    description: 'Enable or disable Unicode emoji',
    type: 'boolean',
    default: false,
  },
  {
    name: 'gitLabAutomerge',
    description: `Enable or disable usage of GitLab's "merge when pipeline succeeds" feature when automerging PRs`,
    type: 'boolean',
    default: false,
  },
];

export function getOptions(): any {
  return options;
}
