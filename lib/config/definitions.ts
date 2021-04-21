import { PLATFORM_TYPE_GITHUB } from '../constants/platforms';
import { getManagers } from '../manager';
import { getPlatformList } from '../platform';
import { getVersioningList } from '../versioning';
import * as dockerVersioning from '../versioning/docker';
import * as pep440Versioning from '../versioning/pep440';
import * as semverVersioning from '../versioning/semver';
import type { RenovateOptions } from './types';

const options: RenovateOptions[] = [
  {
    name: 'allowPostUpgradeCommandTemplating',
    description: 'If true allow templating for post-upgrade commands.',
    type: 'boolean',
    default: false,
    admin: true,
  },
  {
    name: 'allowedPostUpgradeCommands',
    description:
      'A list of regular expressions that determine which post-upgrade tasks are allowed.',
    type: 'array',
    subType: 'string',
    default: [],
    admin: true,
  },
  {
    name: 'postUpgradeTasks',
    description:
      'Post-upgrade tasks that are executed before a commit is made by Renovate.',
    type: 'object',
    default: {
      commands: [],
      fileFilters: [],
      executionMode: 'update',
    },
  },
  {
    name: 'commands',
    description:
      'A list of post-upgrade commands that are executed before a commit is made by Renovate.',
    type: 'array',
    subType: 'string',
    parent: 'postUpgradeTasks',
    default: [],
    cli: false,
  },
  {
    name: 'fileFilters',
    description:
      'Files that match these glob patterns will be committed if they are present after running a post-upgrade task.',
    type: 'array',
    subType: 'string',
    parent: 'postUpgradeTasks',
    default: [],
    cli: false,
  },
  {
    name: 'executionMode',
    description:
      'Controls whether the post upgrade tasks runs for every update or once per upgrade branch',
    type: 'string',
    parent: 'postUpgradeTasks',
    allowedValues: ['update', 'branch'],
    default: 'update',
    cli: false,
  },
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
    name: 'onboardingCommitMessage',
    description:
      'Change this value in order to override the default onboarding commit message.',
    type: 'string',
    default: null,
    admin: true,
    cli: false,
  },
  {
    name: 'onboardingConfigFileName',
    description:
      'Change this value in order to override the default onboarding config file name.',
    type: 'string',
    default: 'renovate.json',
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
    description: 'Links which are embedded within PRs, issues, etc.',
    type: 'object',
    admin: true,
    mergeable: true,
    default: {
      documentation: 'https://docs.renovatebot.com/',
      help: 'https://github.com/renovatebot/renovate/discussions',
      homepage: 'https://github.com/renovatebot/renovate',
    },
    additionalProperties: {
      type: 'string',
      format: 'uri',
    },
  },
  {
    name: 'secrets',
    description: 'Object containing secret name/value pairs',
    type: 'object',
    admin: true,
    mergeable: true,
    default: {},
    additionalProperties: {
      type: 'string',
    },
  },
  {
    name: 'extends',
    description:
      'Configuration presets to use/extend. Note: does not work if configured in config.js.',
    stage: 'package',
    type: 'array',
    subType: 'string',
    allowString: true,
    cli: false,
  },
  {
    name: 'ignorePresets',
    description:
      'A list of presets to ignore, including nested ones inside `extends`.',
    stage: 'package',
    type: 'array',
    subType: 'string',
    allowString: true,
    cli: false,
  },
  {
    name: 'description',
    description: 'Plain text description for a config or preset.',
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
    description: `Enable or disable the bot.`,
    stage: 'package',
    type: 'boolean',
    cli: false,
    env: false,
  },
  {
    name: 'repositoryCache',
    description: 'Option to do repository extract caching.',
    admin: true,
    type: 'string',
    allowedValues: ['disabled', 'enabled', 'reset'],
    stage: 'repository',
    default: 'disabled',
  },
  {
    name: 'force',
    description:
      'Any configuration defined within this object will force override existing settings.',
    stage: 'package',
    admin: true,
    type: 'object',
    cli: false,
    env: false,
  },
  {
    name: 'forceCli',
    description:
      'Whether CLI configuration options should be moved to the `force` config section.',
    stage: 'global',
    type: 'boolean',
    default: true,
  },
  {
    name: 'draftPR',
    description: 'If enabled, the PR created by Renovate is set to a draft.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'dryRun',
    description:
      'If enabled, perform a dry run by logging messages instead of creating/updating/deleting branches and PRs.',
    type: 'boolean',
    admin: true,
    default: false,
  },
  {
    name: 'printConfig',
    description:
      'If enabled, log the full resolved config for each repo, including resolved presets.',
    type: 'boolean',
    admin: true,
    default: false,
  },
  {
    name: 'binarySource',
    description:
      'Controls whether third party tools like npm or Gradle are called directly, or via Docker sidecar containers.',
    admin: true,
    type: 'string',
    allowedValues: ['global', 'docker'],
    default: 'global',
  },
  {
    name: 'redisUrl',
    description:
      'If defined, this Redis URL will be used for caching instead of the file system.',
    stage: 'global',
    type: 'string',
  },
  {
    name: 'baseDir',
    description:
      'The base directory for Renovate to store local files, including repository files and cache. If left empty, Renovate will create its own temporary directory to use.',
    stage: 'global',
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
    name: 'customEnvVariables',
    description:
      'Custom environment variables for child processes and sidecar Docker containers.',
    admin: true,
    type: 'object',
    default: false,
  },
  {
    name: 'dockerChildPrefix',
    description:
      'Change this value in order to add a prefix to the Renovate Docker sidecar image names and labels.',
    type: 'string',
    admin: true,
    default: 'renovate_',
  },
  {
    name: 'dockerImagePrefix',
    description:
      'Change this value in order to override the default Renovate Docker sidecar image name prefix.',
    type: 'string',
    default: 'docker.io/renovate',
    admin: true,
  },
  {
    name: 'dockerUser',
    description:
      'Specify UID and GID for Docker-based binaries when binarySource=docker is used.',
    admin: true,
    type: 'string',
  },
  {
    name: 'composerIgnorePlatformReqs',
    description:
      'Enable / disable use of --ignore-platform-reqs in the Composer package manager.',
    type: 'boolean',
    default: true,
    admin: true,
  },
  // Log options
  {
    name: 'logFile',
    description: 'Log file path.',
    stage: 'global',
    type: 'string',
  },
  {
    name: 'logFileLevel',
    description: 'Log file log level.',
    stage: 'global',
    type: 'string',
    default: 'debug',
  },
  {
    name: 'logContext',
    description: 'Add a global or per-repo log context to each log entry.',
    admin: true,
    type: 'string',
    default: null,
  },
  // Onboarding
  {
    name: 'onboarding',
    description: 'Require a Configuration PR first.',
    stage: 'repository',
    type: 'boolean',
    admin: true,
  },
  {
    name: 'onboardingConfig',
    description: 'Configuration to use in onboarding PRs.',
    stage: 'repository',
    type: 'object',
    default: { $schema: 'https://docs.renovatebot.com/renovate-schema.json' },
    admin: true,
    mergeable: true,
  },
  {
    name: 'includeForks',
    description:
      'Whether to process forked repositories or not. By default, all forked repositories are skipped.',
    stage: 'repository',
    type: 'boolean',
    default: false,
  },
  {
    name: 'forkMode',
    description:
      'Set to true to fork the source repository and create branches there instead.',
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
      'Set to true to first check for disabling in config before cloning.',
    stage: 'repository',
    type: 'boolean',
    default: false,
    admin: true,
  },
  // Dependency Dashboard
  {
    name: 'dependencyDashboard',
    description:
      'Whether to create a "Dependency Dashboard" issue within the repository.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'dependencyDashboardApproval',
    description:
      'Whether updates should require manual approval from within the Dependency Dashboard issue before creation.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'dependencyDashboardAutoclose',
    description:
      'Set to `true` and Renovate will autoclose the Dependency Dashboard issue if there are no updates.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'dependencyDashboardTitle',
    description: 'Title to use for the Dependency Dashboard issue.',
    type: 'string',
    default: `Dependency Dashboard`,
  },
  {
    name: 'dependencyDashboardHeader',
    description:
      'Any text added here will be placed first in the Dependency Dashboard issue body.',
    type: 'string',
    default:
      'This issue contains a list of Renovate updates and their statuses.',
  },
  {
    name: 'dependencyDashboardFooter',
    description:
      'Any text added here will be placed last in the Dependency Dashboard issue body, with a divider separator before it.',
    type: 'string',
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
    description: 'Server-side private key.',
    stage: 'repository',
    type: 'string',
    replaceLineReturns: true,
    admin: true,
  },
  {
    name: 'privateKeyPath',
    description: 'Path to the Server-side private key.',
    stage: 'repository',
    type: 'string',
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
    description: 'Times of day/week to limit branch creation to.',
    type: 'array',
    subType: 'string',
    allowString: true,
    cli: true,
    env: false,
    default: ['at any time'],
  },
  {
    name: 'updateNotScheduled',
    description:
      'Whether to update (but not create) branches when not scheduled.',
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
    name: 'exposeAllEnv',
    description:
      'Configure this to true to allow passing of all env variables to package managers.',
    admin: true,
    type: 'boolean',
    default: false,
  },
  {
    name: 'allowScripts',
    description:
      'Configure this to true if repositories are allowed to run install scripts.',
    admin: true,
    type: 'boolean',
    default: false,
  },
  {
    name: 'allowCustomCrateRegistries',
    description:
      'Configure this to true if custom crate registries are allowed.',
    admin: true,
    type: 'boolean',
    default: false,
  },
  {
    name: 'ignoreScripts',
    description:
      'Configure this to true if allowScripts=true but you wish to skip running scripts when updating lock files.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'platform',
    description: 'Platform type of repository.',
    type: 'string',
    allowedValues: getPlatformList(),
    default: PLATFORM_TYPE_GITHUB,
    admin: true,
  },
  {
    name: 'endpoint',
    description: 'Custom endpoint to use.',
    type: 'string',
    admin: true,
    default: null,
  },
  {
    name: 'token',
    description: 'Repository Auth Token.',
    stage: 'repository',
    type: 'string',
    admin: true,
  },
  {
    name: 'username',
    description: 'Username for authentication. Currently Bitbucket only.',
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
    description: 'String copy of npmrc file. Use \\n instead of line breaks.',
    stage: 'branch',
    type: 'string',
  },
  {
    name: 'npmToken',
    description: 'npm token used for authenticating with the default registry.',
    stage: 'branch',
    type: 'string',
  },
  {
    name: 'yarnrc',
    description: 'String copy of yarnrc file. Use \\n instead of line breaks.',
    stage: 'branch',
    type: 'string',
  },
  {
    name: 'updateLockFiles',
    description: 'Set to false to disable lock file updating.',
    type: 'boolean',
  },
  {
    name: 'skipInstalls',
    description:
      'Skip installing modules/dependencies if lock file updating is possible alone.',
    type: 'boolean',
    default: null,
    admin: true,
  },
  {
    name: 'autodiscover',
    description: 'Autodiscover all repositories.',
    stage: 'global',
    type: 'boolean',
    default: false,
  },
  {
    name: 'autodiscoverFilter',
    description: 'Filter the list of autodiscovered repositories.',
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
    description: 'List of Repositories.',
    stage: 'global',
    type: 'array',
    cli: false,
  },
  {
    name: 'baseBranches',
    description:
      'An array of one or more custom base branches to be processed. If left empty, the default branch will be chosen.',
    type: 'array',
    stage: 'package',
    cli: false,
  },
  {
    name: 'gitAuthor',
    description: 'Author to use for Git commits. Must conform to RFC5322.',
    type: 'string',
    admin: true,
  },
  {
    name: 'gitPrivateKey',
    description: 'PGP key to use for signing Git commits.',
    type: 'string',
    cli: false,
    admin: true,
    stage: 'global',
  },
  {
    name: 'gitIgnoredAuthors',
    description:
      'Additional git authors which are ignored by Renovate. Must conform to RFC5322.',
    type: 'array',
    subType: 'string',
    stage: 'repository',
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
    description: 'Include package files only within these defined paths.',
    type: 'array',
    subType: 'string',
    stage: 'repository',
    default: [],
  },
  {
    name: 'ignorePaths',
    description:
      'Skip any package file whose path matches one of these. Can be a string or glob pattern.',
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
    name: 'aliases',
    description: 'Aliases for registries, package manager specific.',
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
      'List of URLs to try for dependency lookup. Package manager specific.',
    type: 'array',
    subType: 'string',
    default: null,
    stage: 'branch',
    cli: false,
    env: false,
  },
  {
    name: 'extractVersion',
    description:
      "A regex (re2) to extract a version from a datasource's raw version string.",
    type: 'string',
    format: 'regex',
    cli: false,
    env: false,
  },
  {
    name: 'versioning',
    description: 'Versioning to use for filtering and comparisons.',
    type: 'string',
    allowedValues: getVersioningList(),
    default: semverVersioning.id,
    cli: false,
    env: false,
  },
  {
    name: 'azureAutoComplete',
    description:
      'If set to true, Azure DevOps PRs will be set to auto-complete after all (if any) branch policies have been met.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'azureWorkItemId',
    description:
      'The id of an existing work item on Azure Boards to link to each PR.',
    type: 'integer',
    default: 0,
  },
  // depType
  {
    name: 'ignoreDeps',
    description: 'Dependencies to ignore.',
    type: 'array',
    subType: 'string',
    stage: 'package',
    mergeable: true,
  },
  {
    name: 'updateInternalDeps',
    description:
      'Whether to update internal dep versions in a monorepo (Lerna or Yarn Workspaces).',
    type: 'boolean',
    default: false,
    stage: 'package',
  },
  {
    name: 'packageRules',
    description: 'Rules for matching package names.',
    type: 'array',
    stage: 'package',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'matchLanguages',
    description:
      'List of languages to match (e.g. ["python"]). Valid only within `packageRules` object.',
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
    name: 'matchBaseBranches',
    description:
      'List of branches to match (e.g. ["master"]). Valid only within `packageRules` object.',
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
    name: 'matchManagers',
    description:
      'List of package managers to match (e.g. ["pipenv"]). Valid only within `packageRules` object.',
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
    name: 'matchDatasources',
    description:
      'List of datasources to match (e.g. ["orb"]). Valid only within `packageRules` object.',
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
    name: 'matchDepTypes',
    description:
      'List of depTypes to match (e.g. [`peerDependencies`]). Valid only within `packageRules` object.',
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
    name: 'matchPackageNames',
    description:
      'Package names to match. Valid only within `packageRules` object.',
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
      'Package names to exclude. Valid only within `packageRules` object.',
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
    name: 'matchPackagePrefixes',
    description:
      'Package name prefixes to match. Valid only within `packageRules` object.',
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
    name: 'excludePackagePrefixes',
    description:
      'Package name prefixes to exclude. Valid only within `packageRules` object.',
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
    name: 'matchPackagePatterns',
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
      'A version or version range to match against the current version of a package. Valid only within `packageRules` object.',
    type: 'string',
    stage: 'package',
    parent: 'packageRules',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'matchSourceUrlPrefixes',
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
    name: 'matchUpdateTypes',
    description:
      'Update types to match against (major, minor, pin, etc). Valid only within `packageRules` object.',
    type: 'array',
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
    name: 'matchFiles',
    description:
      'List of strings to do an exact match against package files with full path. Applicable inside packageRules only.',
    type: 'array',
    subType: 'string',
    stage: 'repository',
    parent: 'packageRules',
    cli: false,
    env: false,
  },
  {
    name: 'matchPaths',
    description:
      'List of strings or glob patterns to match against package files. Applicable inside packageRules only.',
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
    description:
      'A version range or regex pattern capturing allowed versions for dependencies.',
    type: 'string',
    parent: 'packageRules',
    stage: 'package',
    cli: false,
    env: false,
  },
  {
    name: 'pinDigests',
    description: 'Whether to add digests to Dockerfile source images.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'separateMajorMinor',
    description:
      'If set to false, it will upgrade dependencies to latest release only, and not separate major/minor branches.',
    type: 'boolean',
  },
  {
    name: 'separateMultipleMajor',
    description:
      'If set to true, PRs will be raised separately for each available major upgrade version.',
    stage: 'package',
    type: 'boolean',
    default: false,
  },
  {
    name: 'separateMinorPatch',
    description:
      'If set to true, it will separate minor and patch updates into separate branches.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'ignoreUnstable',
    description: 'Ignore versions with unstable SemVer.',
    stage: 'package',
    type: 'boolean',
  },
  {
    name: 'ignoreDeprecated',
    description:
      'Ignore deprecated versions unless the current version is deprecated.',
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
    description: 'Ignore versions newer than npm "latest" version.',
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
    description: 'Prefix to use for all branch names.',
    stage: 'branch',
    type: 'string',
    default: `renovate/`,
  },
  {
    name: 'bumpVersion',
    description: 'Bump the version in the package file being updated.',
    type: 'string',
    allowedValues: ['major', 'minor', 'patch'],
  },
  // Major/Minor/Patch
  {
    name: 'major',
    description: 'Configuration to apply when an update type is major.',
    stage: 'package',
    type: 'object',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'minor',
    description: 'Configuration to apply when an update type is minor.',
    stage: 'package',
    type: 'object',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'patch',
    description: 'Configuration to apply when an update type is patch.',
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
      rebaseWhen: 'behind-base-branch',
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
      'Configuration to apply when updating a digest (no change in tag/version).',
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
  {
    name: 'rollback',
    description: 'Configuration to apply when rolling back a version.',
    stage: 'package',
    type: 'object',
    default: {
      branchTopic: '{{{depNameSanitized}}}-rollback',
      commitMessageAction: 'Roll back',
      semanticCommitType: 'fix',
    },
    cli: false,
    mergeable: true,
  },
  // Semantic commit / Semantic release
  {
    name: 'semanticCommits',
    description: 'Enable Semantic Commit prefixes for commits and PR titles.',
    type: 'string',
    allowedValues: ['auto', 'enabled', 'disabled'],
    default: 'auto',
  },
  {
    name: 'semanticCommitType',
    description: 'Commit type to use if Semantic Commits is enabled.',
    type: 'string',
    default: 'chore',
  },
  {
    name: 'semanticCommitScope',
    description: 'Commit scope to use if Semantic Commits are enabled.',
    type: 'string',
    default: 'deps',
  },
  // PR Behaviour
  {
    name: 'rollbackPrs',
    description:
      'Create PRs to roll back versions if the current version is not found in the registry.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'recreateClosed',
    description: 'Recreate PRs even if same ones were closed previously.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'rebaseWhen',
    description: 'Control when Renovate decides to rebase an existing branch.',
    type: 'string',
    allowedValues: ['auto', 'never', 'conflicted', 'behind-base-branch'],
    default: 'auto',
  },
  {
    name: 'rebaseLabel',
    description: 'Label to use to request the bot to rebase a PR manually.',
    type: 'string',
    default: 'rebase',
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
    description: 'Timeout in hours for when prCreation=not-pending.',
    type: 'integer',
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
    name: 'branchConcurrentLimit',
    description:
      'Limit to a maximum of x concurrent branches. 0 means no limit, `null` (default) inherits value from `prConcurrentLimit`.',
    type: 'integer',
    default: null, // inherit prConcurrentLimit
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
      'Whether to automerge branches/PRs automatically, without human intervention.',
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
      'PR comment to add to trigger automerge. Used only if automergeType=pr-comment.',
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
    name: 'transitiveRemediation',
    description: 'Enable remediation of transitive dependencies.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'vulnerabilityAlerts',
    description:
      'Config to apply when a PR is necessary due to vulnerability of existing package version.',
    type: 'object',
    default: {
      groupName: null,
      schedule: [],
      dependencyDashboardApproval: false,
      rangeStrategy: 'update-lockfile',
      commitMessageSuffix: '[SECURITY]',
      branchTopic: `{{{datasource}}}-{{{depName}}}-vulnerability`,
      prCreation: 'immediate',
    },
    mergeable: true,
    cli: false,
    env: false,
  },
  // Default templates
  {
    name: 'branchName',
    description: 'Branch name template.',
    type: 'string',
    default: '{{{branchPrefix}}}{{{additionalBranchPrefix}}}{{{branchTopic}}}',
    cli: false,
  },
  {
    name: 'additionalBranchPrefix',
    description: 'Additional string value to be appended to branchPrefix.',
    type: 'string',
    default: '',
    cli: false,
  },
  {
    name: 'branchTopic',
    description: 'Branch topic.',
    type: 'string',
    default:
      '{{{depNameSanitized}}}-{{{newMajor}}}{{#if isPatch}}.{{{newMinor}}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
    cli: false,
  },
  {
    name: 'commitMessage',
    description: 'Message to use for commit messages and pull request titles.',
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
      'If enabled, append a table in the commit message body describing all updates in the commit.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'commitMessagePrefix',
    description:
      'Prefix to add to start of commit messages and PR titles. Uses a semantic prefix if semanticCommits enabled.',
    type: 'string',
    cli: false,
  },
  {
    name: 'commitMessageAction',
    description: 'Action verb to use in commit messages and PR titles.',
    type: 'string',
    default: 'Update',
    cli: false,
  },
  {
    name: 'commitMessageTopic',
    description:
      'The upgrade topic/noun used in commit messages and PR titles.',
    type: 'string',
    default: 'dependency {{depName}}',
    cli: false,
  },
  {
    name: 'commitMessageExtra',
    description:
      'Extra description used after the commit message topic - typically the version.',
    type: 'string',
    default:
      'to {{#if isMajor}}v{{{newMajor}}}{{else}}{{#if isSingleVersion}}v{{{newVersion}}}{{else}}{{{newValue}}}{{/if}}{{/if}}',
    cli: false,
  },
  {
    name: 'commitMessageSuffix',
    description: 'Suffix to add to end of commit messages and PR titles.',
    type: 'string',
    cli: false,
  },
  {
    name: 'prBodyTemplate',
    description:
      'Pull Request body template. Controls which sections are rendered in the body.',
    type: 'string',
    default:
      '{{{header}}}{{{table}}}{{{notes}}}{{{changelogs}}}{{{configDescription}}}{{{controls}}}{{{footer}}}',
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
    name: 'prHeader',
    description: 'Any text added here will be placed first in the PR body.',
    type: 'string',
  },
  {
    name: 'prFooter',
    description:
      'Any text added here will be placed last in the PR body, with a divider separator before it.',
    type: 'string',
    default: `This PR has been generated by [Renovate Bot](https://github.com/renovatebot/renovate).`,
  },
  {
    name: 'lockFileMaintenance',
    description: 'Configuration for lock file maintenance.',
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
  {
    name: 'hashedBranchLength',
    description:
      'If enabled, branch names will use a hashing function to ensure each branch has that length.',
    type: 'integer',
    default: null,
    cli: false,
  },
  // Dependency Groups
  {
    name: 'groupName',
    description: 'Human understandable name for the dependency group.',
    type: 'string',
    default: null,
  },
  {
    name: 'groupSlug',
    description:
      'Slug to use for group (e.g. in branch name). Will be calculated from groupName if null.',
    type: 'string',
    default: null,
    cli: false,
    env: false,
  },
  {
    name: 'group',
    description: 'Config if groupName is enabled.',
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
    description: 'Labels to set in Pull Request.',
    type: 'array',
    subType: 'string',
  },
  {
    name: 'addLabels',
    description: 'Labels to add to Pull Request.',
    type: 'array',
    subType: 'string',
    mergeable: true,
  },
  {
    name: 'assignees',
    description:
      'Assignees for Pull Request (either username or email address depending on the platform).',
    type: 'array',
    subType: 'string',
  },
  {
    name: 'assigneesFromCodeOwners',
    description:
      'Determine assignees based on configured code owners and changes in PR.',
    type: 'boolean',
    default: false,
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
      'Assign reviewers and assignees even if the PR is to be automerged.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'reviewers',
    description:
      'Requested reviewers for Pull Requests (either username or email address depending on the platform).',
    type: 'array',
    subType: 'string',
  },
  {
    name: 'reviewersFromCodeOwners',
    description:
      'Determine reviewers based on configured code owners and changes in PR.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'reviewersSampleSize',
    description: 'Take a random sample of given size from reviewers.',
    type: 'integer',
    default: null,
  },
  {
    name: 'additionalReviewers',
    description:
      'Additional reviewers for Pull Requests (in contrast to `reviewers`, this option adds to the existing reviewer list, rather than replacing it).',
    type: 'array',
    subType: 'string',
    mergeable: true,
  },
  {
    name: 'fileMatch',
    description: 'RegEx (re2) pattern for matching manager files.',
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
    description: 'Configuration object for JavaScript language.',
    stage: 'package',
    type: 'object',
    default: {},
    mergeable: true,
  },
  {
    name: 'golang',
    description: 'Configuration object for Go language.',
    stage: 'package',
    type: 'object',
    default: {
      commitMessageTopic: 'module {{depName}}',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'postUpdateOptions',
    description:
      'Enable post-update options to be run after package/artifact updating.',
    type: 'array',
    default: [],
    allowedValues: [
      'gomodUpdateImportPaths',
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
    description: 'Configuration object for Ruby language.',
    stage: 'package',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
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
    name: 'supportPolicy',
    description:
      'Dependency support policy, e.g. used for LTS vs non-LTS etc (Node only).',
    type: 'array',
    subType: 'string',
    stage: 'package',
    allowString: true,
  },
  {
    name: 'node',
    description: 'Configuration object for Node version renovation.',
    stage: 'package',
    type: 'object',
    default: {
      commitMessageTopic: 'Node.js',
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'docker',
    description: 'Configuration object for Docker language.',
    stage: 'package',
    type: 'object',
    default: {
      versioning: dockerVersioning.id,
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'php',
    description: 'Configuration object for PHP.',
    stage: 'package',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'python',
    description: 'Configuration object for Python.',
    stage: 'package',
    type: 'object',
    default: {
      versioning: pep440Versioning.id,
    },
    mergeable: true,
    cli: false,
  },
  {
    name: 'constraints',
    description:
      'Configuration object to define language or manager version constraints.',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'java',
    description: 'Configuration object for all Java package managers.',
    stage: 'package',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'dotnet',
    description: 'Configuration object for .NET language.',
    stage: 'package',
    type: 'object',
    default: {},
    mergeable: true,
    cli: false,
  },
  {
    name: 'hostRules',
    description: 'Host rules/configuration including credentials.',
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
      'hostType for a package rule. Can be a platform name or a datasource name.',
    type: 'string',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'domainName',
    description: 'Domain name for a host rule. e.g. "docker.io".',
    type: 'string',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'hostName',
    description: 'Hostname for a host rule. e.g. "index.docker.io".',
    type: 'string',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'baseUrl',
    description: 'baseUrl for a host rule. e.g. "https://api.github.com/".',
    type: 'string',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'timeout',
    description: 'Timeout (in milliseconds) for queries to external endpoints.',
    type: 'integer',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'insecureRegistry',
    description: 'Explicitly turn on insecure Docker registry access (HTTP).',
    type: 'boolean',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'abortOnError',
    description:
      'If enabled, Renovate will abort its run when HTTP request errors occur.',
    type: 'boolean',
    stage: 'repository',
    parent: 'hostRules',
    default: false,
    cli: false,
    env: false,
  },
  {
    name: 'abortIgnoreStatusCodes',
    description:
      'A list of HTTP status codes to ignore and *not* abort the run because of when abortOnError=true.',
    type: 'array',
    subType: 'number',
    stage: 'repository',
    parent: 'hostRules',
    cli: false,
    env: false,
  },
  {
    name: 'enableHttp2',
    description: 'Enable got HTTP/2 support.',
    type: 'boolean',
    stage: 'repository',
    parent: 'hostRules',
    default: false,
    cli: false,
    env: false,
  },
  {
    name: 'concurrentRequestLimit',
    description: 'Limit concurrent requests per host.',
    type: 'integer',
    stage: 'repository',
    parent: 'hostRules',
    default: null,
    cli: false,
    env: false,
  },
  {
    name: 'authType',
    description:
      'Authentication type for http header. e.g. "Bearer" or "Basic".',
    type: 'string',
    stage: 'repository',
    parent: 'hostRules',
    default: 'Bearer',
    cli: false,
    env: false,
  },
  {
    name: 'prBodyDefinitions',
    description: 'Table column definitions for use in PR tables.',
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
    description: 'List of columns to use in PR bodies.',
    type: 'array',
    subType: 'string',
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
      'Options to suppress various types of warnings and other notifications.',
    type: 'array',
    subType: 'string',
    default: ['deprecationWarningIssues'],
    allowedValues: [
      'prIgnoreNotification',
      'branchAutomergeFailure',
      'lockFileErrors',
      'artifactErrors',
      'deprecationWarningIssues',
      'onboardingClose',
    ],
    cli: false,
    env: false,
    mergeable: true,
  },
  {
    name: 'pruneStaleBranches',
    description: `Enable or disable pruning of stale branches.`,
    type: 'boolean',
    default: true,
  },
  {
    name: 'unicodeEmoji',
    description: 'Enable or disable Unicode emoji.',
    type: 'boolean',
    default: true,
  },
  {
    name: 'gitLabAutomerge',
    description: `Enable or disable usage of GitLab's "merge when pipeline succeeds" feature when automerging PRs.`,
    type: 'boolean',
    default: false,
  },
  {
    name: 'regexManagers',
    description: 'Custom managers using regex matching.',
    type: 'array',
    subType: 'object',
    default: [],
    stage: 'package',
    cli: true,
    mergeable: true,
  },
  {
    name: 'matchStrings',
    description:
      'Regex capture rule to use. Valid only within a `regexManagers` object.',
    type: 'array',
    subType: 'string',
    format: 'regex',
    parent: 'regexManagers',
    cli: false,
    env: false,
  },
  {
    name: 'matchStringsStrategy',
    description: 'Strategy how to interpret matchStrings.',
    type: 'string',
    default: 'any',
    allowedValues: ['any', 'recursive', 'combination'],
    parent: 'regexManagers',
    cli: false,
    env: false,
  },
  {
    name: 'depNameTemplate',
    description:
      'Optional depName for extracted dependencies. Valid only within a `regexManagers` object.',
    type: 'string',
    parent: 'regexManagers',
    cli: false,
    env: false,
  },
  {
    name: 'lookupNameTemplate',
    description:
      'Optional lookupName for extracted dependencies, else defaults to depName value. Valid only within a `regexManagers` object.',
    type: 'string',
    parent: 'regexManagers',
    cli: false,
    env: false,
  },
  {
    name: 'datasourceTemplate',
    description:
      'Optional datasource for extracted dependencies. Valid only within a `regexManagers` object.',
    type: 'string',
    parent: 'regexManagers',
    cli: false,
    env: false,
  },
  {
    name: 'versioningTemplate',
    description:
      'Optional versioning for extracted dependencies. Valid only within a `regexManagers` object.',
    type: 'string',
    parent: 'regexManagers',
    cli: false,
    env: false,
  },
  {
    name: 'registryUrlTemplate',
    description:
      'Optional registry URL for extracted dependencies. Valid only within a `regexManagers` object.',
    type: 'string',
    parent: 'regexManagers',
    cli: false,
    env: false,
  },
  {
    name: 'fetchReleaseNotes',
    description: 'Allow to disable release notes fetching.',
    type: 'boolean',
    default: true,
    cli: false,
    env: false,
  },
  {
    name: 'cloneSubmodules',
    description:
      'Set to false to disable initialization of submodules during repository clone.',
    type: 'boolean',
    default: true,
  },
  {
    name: 'ignorePrAuthor',
    description:
      'Set to true to fetch the entire list of PRs instead of only those authored by the Renovate user.',
    type: 'boolean',
    default: false,
  },
];

export function getOptions(): RenovateOptions[] {
  return options;
}

function loadManagerOptions(): void {
  for (const [name, config] of getManagers().entries()) {
    if (config.defaultConfig) {
      const managerConfig: RenovateOptions = {
        name,
        description: `Configuration object for the ${name} manager`,
        stage: 'package',
        type: 'object',
        default: config.defaultConfig,
        mergeable: true,
        cli: false,
        autogenerated: true,
      };
      options.push(managerConfig);
    }
  }
}

loadManagerOptions();
