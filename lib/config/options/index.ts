import { PlatformId } from '../../constants';
import { getManagers } from '../../modules/manager';
import { getPlatformList } from '../../modules/platform';
import { getVersioningList } from '../../modules/versioning';
import * as dockerVersioning from '../../modules/versioning/docker';
import type { RenovateOptions } from '../types';

const options: RenovateOptions[] = [
  {
    name: 'detectGlobalManagerConfig',
    description:
      'If `true`, Renovate will try to detect global manager configuration from the file system.',
    type: 'boolean',
    default: false,
    globalOnly: true,
  },
  {
    name: 'detectHostRulesFromEnv',
    description:
      'If `true`, Renovate will try to detect host rules from environment variables.',
    type: 'boolean',
    default: false,
    globalOnly: true,
  },
  {
    name: 'allowPostUpgradeCommandTemplating',
    description:
      'Set this to `true` to allow templating for post-upgrade commands.',
    type: 'boolean',
    default: false,
    globalOnly: true,
  },
  {
    name: 'allowedPostUpgradeCommands',
    description:
      'A list of regular expressions that decide which post-upgrade tasks are allowed.',
    type: 'array',
    subType: 'string',
    default: [],
    globalOnly: true,
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
      'Files that match the glob pattern will be committed after running a post-upgrade task.',
    type: 'array',
    subType: 'string',
    parent: 'postUpgradeTasks',
    default: [],
    cli: false,
  },
  {
    name: 'executionMode',
    description:
      'Controls when the post upgrade tasks run: on every update, or once per upgrade branch.',
    type: 'string',
    parent: 'postUpgradeTasks',
    allowedValues: ['update', 'branch'],
    default: 'update',
    cli: false,
  },
  {
    name: 'onboardingBranch',
    description:
      'Change this value to override the default onboarding branch name.',
    type: 'string',
    default: 'renovate/configure',
    globalOnly: true,
    cli: false,
  },
  {
    name: 'onboardingCommitMessage',
    description:
      'Change this value to override the default onboarding commit message.',
    type: 'string',
    default: null,
    globalOnly: true,
    cli: false,
  },
  {
    name: 'onboardingConfigFileName',
    description:
      'Change this value to override the default onboarding config file name.',
    type: 'string',
    default: 'renovate.json',
    globalOnly: true,
    cli: false,
  },
  {
    name: 'onboardingNoDeps',
    description: 'Onboard the repository even if no dependencies are found.',
    type: 'boolean',
    default: false,
    globalOnly: true,
  },
  {
    name: 'onboardingPrTitle',
    description:
      'Change this value to override the default onboarding PR title.',
    type: 'string',
    default: 'Configure Renovate',
    globalOnly: true,
    cli: false,
  },
  {
    name: 'configMigration',
    description: 'Enable this to get config migration PRs when needed.',
    stage: 'repository',
    type: 'boolean',
    default: false,
    experimental: true,
    experimentalDescription:
      'Config migration PRs are still being improved, in particular to reduce the amount of reordering and whitespace changes.',
    experimentalIssues: [16359],
  },
  {
    name: 'productLinks',
    description: 'Links which are used in PRs, issues and comments.',
    type: 'object',
    globalOnly: true,
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
    description: 'Object which holds secret name/value pairs.',
    type: 'object',
    globalOnly: true,
    mergeable: true,
    default: {},
    additionalProperties: {
      type: 'string',
    },
  },
  {
    name: 'extends',
    description: 'Configuration presets to use or extend.',
    stage: 'package',
    type: 'array',
    subType: 'string',
    allowString: true,
    cli: false,
  },
  {
    name: 'ignorePresets',
    description:
      'A list of presets to ignore, including any that are nested inside an `extends` array.',
    stage: 'package',
    type: 'array',
    subType: 'string',
    allowString: true,
    cli: false,
  },
  {
    name: 'migratePresets',
    description:
      'Define presets here which have been removed or renamed and should be migrated automatically.',
    type: 'object',
    globalOnly: true,
    default: {},
    additionalProperties: {
      type: 'string',
    },
  },
  {
    name: 'globalExtends',
    description:
      'Configuration presets to use or extend for a self-hosted config.',
    type: 'array',
    subType: 'string',
    globalOnly: true,
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
    description: `Enable or disable Renovate bot.`,
    stage: 'package',
    type: 'boolean',
    cli: false,
    env: false,
  },
  {
    name: 'repositoryCache',
    description:
      'This option decides if Renovate uses a JSON cache to speed up extractions.',
    globalOnly: true,
    type: 'string',
    allowedValues: ['disabled', 'enabled', 'reset'],
    stage: 'repository',
    default: 'disabled',
    experimental: true,
  },
  {
    name: 'repositoryCacheType',
    description:
      'Set the type of renovate repository cache if repositoryCache is not disabled.',
    globalOnly: true,
    type: 'string',
    stage: 'repository',
    default: 'local',
    experimental: true,
  },
  {
    name: 'force',
    description:
      'Any configuration set in this object will force override existing settings.',
    stage: 'package',
    globalOnly: true,
    type: 'object',
    cli: false,
    env: false,
  },
  {
    name: 'forceCli',
    description:
      'Decides if CLI configuration options are moved to the `force` config section.',
    stage: 'global',
    type: 'boolean',
    default: true,
    globalOnly: true,
  },
  {
    name: 'draftPR',
    description:
      'If set to `true` then Renovate creates draft PRs, instead of normal status PRs.',
    type: 'boolean',
    default: false,
    supportedPlatforms: ['azure', 'gitea', 'github', 'gitlab'],
  },
  {
    name: 'dryRun',
    description:
      'If enabled, perform a dry run by logging messages instead of creating/updating/deleting branches and PRs.',
    type: 'string',
    globalOnly: true,
    allowedValues: ['extract', 'lookup', 'full'],
    default: null,
  },
  {
    name: 'printConfig',
    description:
      'If enabled, Renovate logs the fully resolved config for each repo, plus the fully resolved presets.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'binarySource',
    description:
      'Controls how third-party tools like npm or Gradle are called: directly, via Docker sidecar containers, or via dynamic install.',
    globalOnly: true,
    type: 'string',
    allowedValues: ['global', 'docker', 'install', 'hermit'],
    default: 'global',
  },
  {
    name: 'redisUrl',
    description:
      'If set, this Redis URL will be used for caching instead of the file system.',
    stage: 'global',
    type: 'string',
    globalOnly: true,
  },
  {
    name: 'baseDir',
    description:
      'The base directory for Renovate to store local files, including repository files and cache. If left empty, Renovate will create its own temporary directory to use.',
    stage: 'global',
    type: 'string',
    globalOnly: true,
  },
  {
    name: 'cacheDir',
    description:
      'The directory where Renovate stores its cache. If left empty, Renovate creates a subdirectory within the `baseDir`.',
    globalOnly: true,
    type: 'string',
  },
  {
    name: 'containerbaseDir',
    description:
      'The directory where Renovate stores its containerbase cache. If left empty, Renovate creates a subdirectory within the `cacheDir`.',
    globalOnly: true,
    type: 'string',
  },
  {
    name: 'customEnvVariables',
    description:
      'Custom environment variables for child processes and sidecar Docker containers.',
    globalOnly: true,
    type: 'object',
    default: {},
  },
  {
    name: 'dockerChildPrefix',
    description:
      'Change this value to add a prefix to the Renovate Docker sidecar container names and labels.',
    type: 'string',
    globalOnly: true,
    default: 'renovate_',
  },
  {
    name: 'dockerImagePrefix',
    description:
      'Change this value to override the default Renovate Docker sidecar image name prefix.',
    type: 'string',
    default: 'docker.io/renovate',
    globalOnly: true,
  },
  {
    name: 'dockerUser',
    description:
      'Set the `UID` and `GID` for Docker-based binaries if you use `binarySource=docker`.',
    globalOnly: true,
    type: 'string',
  },
  {
    name: 'composerIgnorePlatformReqs',
    description:
      'Configure use of `--ignore-platform-reqs` or `--ignore-platform-req` for the Composer package manager.',
    type: 'array',
    subType: 'string',
    default: [],
  },
  // Log options
  {
    name: 'logFile',
    description: 'Log file path.',
    stage: 'global',
    type: 'string',
    globalOnly: true,
  },
  {
    name: 'logFileLevel',
    description: 'Set the log file log level.',
    stage: 'global',
    type: 'string',
    default: 'debug',
    globalOnly: true,
  },
  {
    name: 'logContext',
    description: 'Add a global or per-repo log context to each log entry.',
    globalOnly: true,
    type: 'string',
    default: null,
  },
  // Onboarding
  {
    name: 'onboarding',
    description: 'Require a Configuration PR first.',
    stage: 'repository',
    type: 'boolean',
    globalOnly: true,
  },
  {
    name: 'onboardingConfig',
    description: 'Configuration to use for onboarding PRs.',
    stage: 'repository',
    type: 'object',
    default: { $schema: 'https://docs.renovatebot.com/renovate-schema.json' },
    globalOnly: true,
    mergeable: true,
  },
  {
    name: 'includeForks',
    description:
      'Whether to process forked repositories. By default, all forked repositories are skipped.',
    stage: 'repository',
    type: 'boolean',
    default: false,
  },
  {
    name: 'forkMode',
    description:
      'Set to `true` to fork the source repository and create branches there instead.',
    stage: 'repository',
    type: 'boolean',
    default: false,
    globalOnly: true,
  },
  {
    name: 'forkToken',
    description:
      'Will be used on GitHub when `forkMode` is set to `true` to clone the repositories.',
    stage: 'repository',
    type: 'string',
    default: '',
    globalOnly: true,
  },
  {
    name: 'githubTokenWarn',
    description: 'Display warnings about GitHub token not being set.',
    type: 'boolean',
    default: true,
    globalOnly: true,
  },
  {
    name: 'requireConfig',
    description:
      "Controls Renovate's behavior regarding repository config files such as `renovate.json`.",
    stage: 'repository',
    type: 'string',
    default: 'required',
    allowedValues: ['required', 'optional', 'ignored'],
    globalOnly: true,
  },
  {
    name: 'optimizeForDisabled',
    description:
      'Set to `true` to first check for disabling in config before cloning.',
    stage: 'repository',
    type: 'boolean',
    default: false,
    globalOnly: true,
  },
  // Dependency Dashboard
  {
    name: 'dependencyDashboard',
    description:
      'Whether to create a "Dependency Dashboard" issue in the repository.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'dependencyDashboardApproval',
    description:
      'Controls if updates need manual approval from the Dependency Dashboard issue before PRs are created.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'dependencyDashboardAutoclose',
    description:
      'Set to `true` to let Renovate close the Dependency Dashboard issue if there are no more updates.',
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
      'This issue lists Renovate updates and detected dependencies. Read the [Dependency Dashboard](https://docs.renovatebot.com/key-concepts/dashboard/) docs to learn more.',
  },
  {
    name: 'dependencyDashboardFooter',
    description:
      'Any text added here will be placed last in the Dependency Dashboard issue body, with a divider separator before it.',
    type: 'string',
  },
  {
    name: 'dependencyDashboardLabels',
    description:
      'These labels will always be applied on the Dependency Dashboard issue, even when they have been removed manually.',
    type: 'array',
    subType: 'string',
    default: null,
  },
  {
    name: 'configWarningReuseIssue',
    description:
      'Set this to `false` to make Renovate create a new issue for each config warning, instead of reopening or reusing an existing issue.',
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
    globalOnly: true,
  },
  {
    name: 'privateKeyOld',
    description: 'Secondary or old private key to try.',
    stage: 'repository',
    type: 'string',
    replaceLineReturns: true,
    globalOnly: true,
  },
  {
    name: 'privateKeyPath',
    description: 'Path to the Server-side private key.',
    stage: 'repository',
    type: 'string',
    globalOnly: true,
  },
  {
    name: 'privateKeyPathOld',
    description: 'Path to the Server-side old private key.',
    stage: 'repository',
    type: 'string',
    globalOnly: true,
  },
  {
    name: 'encrypted',
    description:
      'An object containing configuration encrypted with project key.',
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
    description: 'Limit branch creation to these times of day or week.',
    type: 'array',
    subType: 'string',
    allowString: true,
    cli: true,
    env: false,
    default: ['at any time'],
  },
  {
    name: 'automergeSchedule',
    description: 'Limit automerge to these times of day or week.',
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
      'Whether to update branches when not scheduled. Renovate will not create branches outside of the schedule.',
    stage: 'branch',
    type: 'boolean',
  },
  // Bot administration
  {
    name: 'persistRepoData',
    description:
      'If set to `true`, repository data is kept between runs instead of deleted.',
    type: 'boolean',
    globalOnly: true,
    default: false,
  },
  {
    name: 'exposeAllEnv',
    description:
      'Set this to `true` to allow passing of all environment variables to package managers.',
    globalOnly: true,
    type: 'boolean',
    default: false,
  },
  {
    name: 'allowPlugins',
    description:
      'Set this to `true` if repositories are allowed to run install plugins.',
    globalOnly: true,
    type: 'boolean',
    default: false,
  },
  {
    name: 'allowScripts',
    description:
      'Set this to `true` if repositories are allowed to run install scripts.',
    globalOnly: true,
    type: 'boolean',
    default: false,
  },
  {
    name: 'allowCustomCrateRegistries',
    description: 'Set this to `true` if custom crate registries are allowed.',
    globalOnly: true,
    type: 'boolean',
    default: false,
  },
  {
    name: 'ignorePlugins',
    description:
      'Set this to `true` if `allowPlugins=true` but you wish to skip running plugins when updating lock files.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'ignoreScripts',
    description:
      'Set this to `true` if `allowScripts=true` but you wish to skip running scripts when updating lock files.',
    type: 'boolean',
    default: false,
    supportedManagers: ['npm', 'composer'],
  },
  {
    name: 'platform',
    description: 'Platform type of repository.',
    type: 'string',
    allowedValues: getPlatformList(),
    default: PlatformId.Github,
    globalOnly: true,
  },
  {
    name: 'endpoint',
    description: 'Custom endpoint to use.',
    type: 'string',
    globalOnly: true,
    default: null,
  },
  {
    name: 'token',
    description: 'Repository Auth Token.',
    stage: 'repository',
    type: 'string',
    globalOnly: true,
  },
  {
    name: 'username',
    description: 'Username for authentication.',
    stage: 'repository',
    type: 'string',
    supportedPlatforms: ['azure', 'bitbucket', 'bitbucket-server'],
    globalOnly: true,
  },
  {
    name: 'password',
    description: 'Password for authentication.',
    stage: 'repository',
    type: 'string',
    supportedPlatforms: ['azure', 'bitbucket', 'bitbucket-server'],
    globalOnly: true,
  },
  {
    name: 'npmrc',
    description:
      'String copy of `.npmrc` file. Use `\\n` instead of line breaks.',
    stage: 'branch',
    type: 'string',
  },
  {
    name: 'npmrcMerge',
    description:
      'Whether to merge `config.npmrc` with repo `.npmrc` content if both are found.',
    stage: 'branch',
    type: 'boolean',
    default: false,
  },
  {
    name: 'npmToken',
    description: 'npm token used to authenticate with the default registry.',
    stage: 'branch',
    type: 'string',
  },
  {
    name: 'updateLockFiles',
    description: 'Set to `false` to disable lock file updating.',
    type: 'boolean',
  },
  {
    name: 'skipInstalls',
    description:
      'Skip installing modules/dependencies if lock file updating is possible without a full install.',
    type: 'boolean',
    default: null,
    globalOnly: true,
  },
  {
    name: 'autodiscover',
    description: 'Autodiscover all repositories.',
    stage: 'global',
    type: 'boolean',
    default: false,
    globalOnly: true,
  },
  {
    name: 'autodiscoverFilter',
    description: 'Filter the list of autodiscovered repositories.',
    stage: 'global',
    type: 'string',
    default: null,
    globalOnly: true,
  },
  {
    name: 'prCommitsPerRunLimit',
    description:
      'Set the maximum number of commits per Renovate run. By default there is no limit.',
    stage: 'global',
    type: 'integer',
    default: 0,
    globalOnly: true,
  },
  {
    name: 'repositories',
    description: 'List of Repositories.',
    stage: 'global',
    type: 'array',
    cli: false,
    globalOnly: true,
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
    name: 'useBaseBranchConfig',
    description:
      'Whether to read configuration from `baseBranches` instead of only the default branch.',
    type: 'string',
    allowedValues: ['merge', 'none'],
    default: 'none',
  },
  {
    name: 'gitAuthor',
    description:
      'Author to use for Git commits. Must conform to [RFC5322](https://datatracker.ietf.org/doc/html/rfc5322).',
    type: 'string',
  },
  {
    name: 'gitPrivateKey',
    description: 'PGP key to use for signing Git commits.',
    type: 'string',
    cli: false,
    globalOnly: true,
    stage: 'global',
  },
  {
    name: 'gitIgnoredAuthors',
    description:
      'Additional Git authors which are ignored by Renovate. Must conform to [RFC5322](https://datatracker.ietf.org/doc/html/rfc5322).',
    type: 'array',
    subType: 'string',
    stage: 'repository',
  },
  {
    name: 'gitTimeout',
    description:
      'Configure the timeout with a number of milliseconds to wait for a Git task.',
    type: 'integer',
    globalOnly: true,
    default: 0,
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
    mergeable: false,
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
    name: 'executionTimeout',
    description:
      'Default execution timeout in minutes for child processes Renovate creates.',
    type: 'integer',
    default: 15,
    globalOnly: true,
  },
  {
    name: 'registryAliases',
    description: 'Aliases for registries.',
    type: 'object',
    default: {},
    additionalProperties: {
      type: 'string',
      format: 'uri',
    },
    supportedManagers: [
      'helm-requirements',
      'helmv3',
      'helmfile',
      'gitlabci',
      'dockerfile',
      'docker-compose',
      'kubernetes',
      'ansible',
      'droneci',
    ],
  },
  {
    name: 'defaultRegistryUrls',
    description:
      'List of registry URLs to use as the default for a datasource.',
    type: 'array',
    subType: 'string',
    default: null,
    stage: 'branch',
    cli: false,
    env: false,
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
      "A regex (`re2`) to extract a version from a datasource's raw version string.",
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
    cli: false,
    env: false,
  },
  {
    name: 'azureWorkItemId',
    description:
      'The id of an existing work item on Azure Boards to link to each PR.',
    type: 'integer',
    default: 0,
    supportedPlatforms: ['azure'],
  },
  {
    name: 'azureAutoApprove',
    description:
      'If set to `true`, Azure DevOps PRs will be automatically approved.',
    type: 'boolean',
    default: false,
    supportedPlatforms: ['azure'],
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
      'Whether to update internal dep versions in a monorepo. Works on Lerna or Yarn Workspaces.',
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
      'List of languages to match (e.g. `["python"]`). Valid only within a `packageRules` object.',
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
      'List of strings containing exact matches (e.g. `["main"]`) and/or regex expressions (e.g. `["/^release\\/.*/"]`). Valid only within a `packageRules` object.',
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
      'List of package managers to match (e.g. `["pipenv"]`). Valid only within a `packageRules` object.',
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
      'List of datasources to match (e.g. `["orb"]`). Valid only within a `packageRules` object.',
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
      'Package names to match. Valid only within a `packageRules` object.',
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
      'Package names to exclude. Valid only within a `packageRules` object.',
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
      'Package name prefixes to match. Valid only within a `packageRules` object.',
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
      'Package name prefixes to exclude. Valid only within a `packageRules` object.',
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
      'Package name patterns to match. Valid only within a `packageRules` object.',
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
      'Package name patterns to exclude. Valid only within a `packageRules` object.',
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
      'A version or range of versions to match against the current version of a package. Valid only within a `packageRules` object.',
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
      'A list of source URL prefixes to match against, commonly used to group monorepos or packages from the same organization.',
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
    name: 'matchSourceUrls',
    description: 'A list of source URLs to exact match against.',
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
    name: 'replacementName',
    description:
      'The name of the new dependency that replaces the old deprecated dependency.',
    type: 'string',
    stage: 'package',
    parent: 'packageRules',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'replacementVersion',
    description:
      'The version of the new dependency that replaces the old deprecated dependency.',
    type: 'string',
    stage: 'package',
    parent: 'packageRules',
    mergeable: true,
    cli: false,
    env: false,
  },
  {
    name: 'matchUpdateTypes',
    description:
      'Update types to match against (`major`, `minor`, `pin`, `pinDigest`, etc). Valid only within `packageRules` object.',
    type: 'array',
    subType: 'string',
    allowedValues: [
      'major',
      'minor',
      'patch',
      'pin',
      'pinDigest',
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
      'List of strings to do an exact match against package files with full path. Will only work inside a `packageRules` object.',
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
      'List of strings or glob patterns to match against package files. Will only work inside a `packageRules` object.',
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
    name: 'customChangelogUrl',
    description:
      'If set, Renovate will use this url to fetch changelogs for a matched dependency. Valid only within a `packageRules` object.',
    type: 'string',
    stage: 'pr',
    parent: 'packageRules',
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
      'If set to `false`, Renovate will upgrade dependencies to their latest release only. Renovate will not separate major or minor branches.',
    type: 'boolean',
  },
  {
    name: 'separateMultipleMajor',
    description:
      'If set to `true`, PRs will be raised separately for each available `major` upgrade version.',
    stage: 'package',
    type: 'boolean',
    default: false,
  },
  {
    name: 'separateMinorPatch',
    description:
      'If set to `true`, Renovate will separate `minor` and `patch` updates into separate branches.',
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
      'Avoid upgrading from a non-deprecated version to a deprecated one.',
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
    description: 'Determines how to modify or update existing ranges.',
    type: 'string',
    default: 'replace',
    allowedValues: [
      'auto',
      'pin',
      'bump',
      'replace',
      'widen',
      'update-lockfile',
      'in-range-only',
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
    name: 'branchPrefixOld',
    description: 'Old Prefix to check for existing PRs.',
    stage: 'branch',
    type: 'string',
    default: `renovate/`,
  },
  {
    name: 'bumpVersion',
    description: 'Bump the version in the package file being updated.',
    type: 'string',
    allowedValues: ['major', 'minor', 'patch', 'prerelease'],
    supportedManagers: ['helmv3', 'npm', 'maven', 'sbt'],
  },
  // Major/Minor/Patch
  {
    name: 'major',
    description: 'Configuration to apply when an update type is `major`.',
    stage: 'package',
    type: 'object',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'minor',
    description: 'Configuration to apply when an update type is `minor`.',
    stage: 'package',
    type: 'object',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'patch',
    description: 'Configuration to apply when an update type is `patch`.',
    stage: 'package',
    type: 'object',
    default: {},
    cli: false,
    mergeable: true,
  },
  {
    name: 'pin',
    description: 'Configuration to apply when an update type is `pin`.',
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
      commitMessageTopic: '{{{depName}}} digest',
    },
    cli: false,
    mergeable: true,
  },
  {
    name: 'pinDigest',
    description:
      'Configuration to apply when pinning a digest (no change in tag/version).',
    stage: 'package',
    type: 'object',
    default: {
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
  {
    name: 'replacement',
    description: 'Configuration to apply when replacing a dependency.',
    stage: 'package',
    type: 'object',
    default: {
      branchTopic: '{{{depNameSanitized}}}-replacement',
      commitMessageAction: 'Replace',
      commitMessageExtra:
        'with {{newName}} {{#if isMajor}}{{{prettyNewMajor}}}{{else}}{{#if isSingleVersion}}{{{prettyNewVersion}}}{{else}}{{{newValue}}}{{/if}}{{/if}}',
      prBodyNotes: [
        'This is a special PR that replaces `{{{depNameSanitized}}}` with the community suggested minimal stable replacement version.',
      ],
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
    description: 'Controls when Renovate rebases an existing branch.',
    type: 'string',
    allowedValues: ['auto', 'never', 'conflicted', 'behind-base-branch'],
    default: 'auto',
  },
  {
    name: 'rebaseLabel',
    description: 'Label to request a rebase from Renovate bot.',
    type: 'string',
    default: 'rebase',
  },
  {
    name: 'stopUpdatingLabel',
    description: 'Label to make Renovate stop updating a PR.',
    type: 'string',
    default: 'stop-updating',
    supportedPlatforms: ['azure', 'github', 'gitlab', 'gitea'],
  },
  {
    name: 'stabilityDays',
    description:
      'Number of days required before a new release is considered stable.',
    type: 'integer',
    default: 0,
  },
  /*
   * Undocumented experimental feature
  {
    name: 'minimumConfidence',
    description:
      'Minimum Merge confidence level to filter by. Requires authentication to work.',
    type: 'string',
    allowedValues: ['low', 'neutral', 'high', 'very high'],
    default: 'low',
  },
  */
  {
    name: 'internalChecksFilter',
    description: 'When and how to filter based on internal checks.',
    type: 'string',
    allowedValues: ['strict', 'flexible', 'none'],
    default: 'none',
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
    description: 'Timeout in hours for when `prCreation=not-pending`.',
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
    supportedPlatforms: ['bitbucket', 'bitbucket-server'],
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
    name: 'automergeStrategy',
    description:
      'The merge strategy to use when automerging PRs. Used only if `automergeType=pr`.',
    type: 'string',
    allowedValues: ['auto', 'fast-forward', 'merge-commit', 'rebase', 'squash'],
    default: 'auto',
    supportedPlatforms: ['bitbucket', 'gitea'],
  },
  {
    name: 'automergeComment',
    description:
      'PR comment to add to trigger automerge. Only used if `automergeType=pr-comment`.',
    type: 'string',
    default: 'automergeComment',
  },
  {
    name: 'ignoreTests',
    description: 'Set to `true` to enable automerging without tests.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'transitiveRemediation',
    description: 'Enable remediation of transitive dependencies.',
    type: 'boolean',
    default: false,
    supportedManagers: ['npm'],
    supportedPlatforms: ['github'],
  },
  {
    name: 'vulnerabilityAlerts',
    description:
      'Config to apply when a PR is needed due to a vulnerability in the existing package version.',
    type: 'object',
    default: {
      groupName: null,
      schedule: [],
      dependencyDashboardApproval: false,
      stabilityDays: 0,
      rangeStrategy: 'update-lockfile',
      commitMessageSuffix: '[SECURITY]',
      branchTopic: `{{{datasource}}}-{{{depName}}}-vulnerability`,
      prCreation: 'immediate',
    },
    mergeable: true,
    cli: false,
    env: false,
    supportedPlatforms: ['github'],
  },
  {
    name: 'pruneBranchAfterAutomerge',
    description: 'Set to `true` to enable branch pruning after automerging.',
    type: 'boolean',
    default: true,
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
    description: 'Additional string value to be appended to `branchPrefix`.',
    type: 'string',
    default: '',
    cli: false,
  },
  {
    name: 'branchTopic',
    description: 'Branch topic.',
    type: 'string',
    default:
      '{{{depNameSanitized}}}-{{{newMajor}}}{{#if separateMinorPatch}}{{#if isPatch}}.{{{newMinor}}}{{/if}}{{/if}}.x{{#if isLockfileUpdate}}-lockfile{{/if}}',
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
      'Prefix to add to start of commit messages and PR titles. Uses a semantic prefix if `semanticCommits` is enabled.',
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
      'to {{#if isPinDigest}}{{{newDigestShort}}}{{else}}{{#if isMajor}}{{prettyNewMajor}}{{else}}{{#if isSingleVersion}}{{prettyNewVersion}}{{else}}{{#if newValue}}{{{newValue}}}{{else}}{{{newDigestShort}}}{{/if}}{{/if}}{{/if}}{{/if}}',
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
      'Pull Request title template (deprecated). Inherits from `commitMessage` if null.',
    type: 'string',
    default: null,
    cli: false,
  },
  {
    name: 'prHeader',
    description: 'Text added here will be placed first in the PR body.',
    type: 'string',
  },
  {
    name: 'prFooter',
    description:
      'Text added here will be placed last in the PR body, with a divider separator before it.',
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
      'Slug to use for group (e.g. in branch name). Will be calculated from `groupName` if `null`.',
    type: 'string',
    default: null,
    cli: false,
    env: false,
  },
  {
    name: 'group',
    description: 'Config if `groupName` is enabled.',
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
    name: 'filterUnavailableUsers',
    description: 'Filter reviewers and assignees based on their availability.',
    type: 'boolean',
    default: false,
    supportedPlatforms: ['gitlab'],
  },
  {
    name: 'confidential',
    description:
      'If enabled, issues created by Renovate are set as confidential.',
    type: 'boolean',
    default: false,
    supportedPlatforms: ['gitlab'],
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
    description: 'RegEx (`re2`) pattern for matching manager files.',
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
      'bundlerConservative',
      'gomodMassage',
      'gomodUpdateImportPaths',
      'gomodTidy',
      'gomodTidy1.17',
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
    default: {},
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
    supportedManagers: [
      'bundler',
      'composer',
      'gomod',
      'npm',
      'pipenv',
      'poetry',
    ],
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
    name: 'matchHost',
    description: 'A domain name, host name or base URL to match against.',
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
      'A list of HTTP status codes safe to ignore even when `abortOnError=true`.',
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
      'Authentication type for http header. e.g. `"Bearer"` or `"Basic"`. Use `"Token-Only"` to use only the token without an authorization type.',
    type: 'string',
    stage: 'repository',
    parent: 'hostRules',
    default: 'Bearer',
    cli: false,
    env: false,
  },
  {
    name: 'dnsCache',
    description: 'Enable got dns cache',
    type: 'boolean',
    stage: 'repository',
    parent: 'hostRules',
    default: false,
    cli: false,
    env: false,
    experimental: true,
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
      Pending: '{{{displayPending}}}',
      References: '{{{references}}}',
      'Package file': '{{{packageFile}}}',
    },
  },
  {
    name: 'prBodyColumns',
    description: 'List of columns to use in PR bodies.',
    type: 'array',
    subType: 'string',
    default: ['Package', 'Type', 'Update', 'Change', 'Pending'],
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
      'configErrorIssue',
    ],
    cli: false,
    env: false,
    mergeable: true,
  },
  {
    name: 'pruneStaleBranches',
    description: 'Set to `false` to disable pruning stale branches.',
    type: 'boolean',
    default: true,
  },
  {
    name: 'unicodeEmoji',
    description: 'Enable or disable Unicode emoji.',
    type: 'boolean',
    default: true,
    globalOnly: true,
  },
  {
    name: 'gitLabIgnoreApprovals',
    description: `Ignore approval rules for MRs created by Renovate, which is useful for automerge.`,
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
    name: 'packageNameTemplate',
    description:
      'Optional packageName for extracted dependencies, else defaults to `depName` value. Valid only within a `regexManagers` object.',
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
    name: 'depTypeTemplate',
    description:
      'Optional `depType` for extracted dependencies. Valid only within a `regexManagers` object.',
    type: 'string',
    parent: 'regexManagers',
    cli: false,
    env: false,
  },
  {
    name: 'currentValueTemplate',
    description:
      'Optional `currentValue` for extracted dependencies. Valid only within a `regexManagers` object.',
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
    name: 'extractVersionTemplate',
    description:
      'Optional `extractVersion` for extracted dependencies. Valid only within a `regexManagers` object.',
    type: 'string',
    parent: 'regexManagers',
    cli: false,
    env: false,
  },
  {
    name: 'autoReplaceStringTemplate',
    description:
      'Optional `extractVersion` for extracted dependencies. Valid only within a `regexManagers` object.',
    type: 'string',
    parent: 'regexManagers',
    cli: false,
    env: false,
  },
  {
    name: 'fetchReleaseNotes',
    description: 'Controls if release notes are fetched.',
    type: 'boolean',
    default: true,
    cli: false,
    env: false,
  },
  {
    name: 'cloneSubmodules',
    description:
      'Set to `true` to enable initialization of submodules during repository clone.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'ignorePrAuthor',
    description:
      'Set to `true` to fetch the entire list of PRs instead of only those authored by the Renovate user.',
    type: 'boolean',
    default: false,
  },
  {
    name: 'gitNoVerify',
    description:
      'Which Git commands will be run with the `--no-verify` option.',
    type: 'array',
    subType: 'string',
    allowString: true,
    allowedValues: ['commit', 'push'],
    default: ['commit', 'push'],
    stage: 'global',
    globalOnly: true,
  },
  {
    name: 'updatePinnedDependencies',
    description:
      'Whether to update pinned (single version) dependencies or not.',
    type: 'boolean',
    default: true,
  },
  {
    name: 'gitUrl',
    description:
      'Overrides the default resolution for Git remote, e.g. to switch GitLab from HTTPS to SSH-based.',
    type: 'string',
    supportedPlatforms: ['gitlab', 'bitbucket-server'],
    allowedValues: ['default', 'ssh', 'endpoint'],
    default: 'default',
    stage: 'repository',
    globalOnly: true,
  },
  {
    name: 'writeDiscoveredRepos',
    description: 'Writes discovered repositories to a JSON file and then exit.',
    type: 'string',
    globalOnly: true,
    env: false,
  },
  {
    name: 'platformAutomerge',
    description: `Controls if platform-native auto-merge is used.`,
    type: 'boolean',
    supportedPlatforms: ['azure', 'gitea', 'github', 'gitlab'],
    default: false,
  },
  {
    name: 'userStrings',
    description:
      'User-facing strings for the Renovate comment when a PR is closed.',
    type: 'object',
    freeChoice: true,
    default: {
      ignoreTopic: 'Renovate Ignore Notification',
      ignoreMajor:
        'As this PR has been closed unmerged, Renovate will ignore this upgrade and you will not receive PRs for *any* future {{{newMajor}}}.x releases. However, if you upgrade to {{{newMajor}}}.x manually then Renovate will reenable minor and patch updates automatically.',
      ignoreDigest:
        'As this PR has been closed unmerged, Renovate will ignore this upgrade and you will not receive PRs for the `{{{depName}}}` `{{{newDigestShort}}}` update again.',
      ignoreOther:
        'As this PR has been closed unmerged, Renovate will now ignore this update ({{{newValue}}}). You will still receive a PR once a newer version is released, so if you wish to permanently ignore this dependency, please add it to the `ignoreDeps` array of your renovate config.',
    },
  },
  {
    name: 'platformCommit',
    description: `Use platform API to perform commits instead of using Git directly.`,
    type: 'boolean',
    default: false,
    supportedPlatforms: ['github'],
  },
  {
    name: 'branchNameStrict',
    description: `Whether to be strict about the use of special characters within the branch name.`,
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
