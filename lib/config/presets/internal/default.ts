import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */
export const presets: Record<string, Preset> = {
  approveMajorUpdates: {
    description: 'Require Dependency Dashboard approval for `major` updates.',
    packageRules: [
      {
        dependencyDashboardApproval: true,
        matchUpdateTypes: ['major'],
      },
    ],
  },
  assignAndReview: {
    description: 'Set `{{arg0}}` as assignee and reviewer of PRs.',
    extends: [':assignee({{arg0}})', ':reviewer({{arg0}})'],
  },
  assignee: {
    assignees: ['{{arg0}}'],
    description: 'Assign PRs to `{{arg0}}`.',
  },
  automergeAll: {
    automerge: true,
    description:
      'Automerge all upgrades (including `major`) if they pass tests.',
  },
  automergeBranch: {
    automergeType: 'branch',
    description:
      'If automerging, push the new commit directly to the base branch (no PR).',
  },
  automergeDigest: {
    description: 'Automerge `digest` upgrades if they pass tests.',
    digest: {
      automerge: true,
    },
  },
  automergeDisabled: {
    automerge: false,
    description:
      'Disable automerging feature - wait for humans to merge all PRs.',
  },
  automergeLinters: {
    description: 'Update lint packages automatically if tests pass.',
    packageRules: [
      {
        automerge: true,
        extends: ['packages:linters'],
      },
    ],
  },
  automergeMajor: {
    automerge: true,
    description:
      'Automerge all upgrades (including `major`) if they pass tests.',
  },
  automergeMinor: {
    description: 'Automerge `patch` and `minor` upgrades if they pass tests.',
    lockFileMaintenance: {
      automerge: true,
    },
    minor: {
      automerge: true,
    },
    patch: {
      automerge: true,
    },
    pin: {
      automerge: true,
    },
  },
  automergePatch: {
    description: 'Automerge `patch` upgrades if they pass tests.',
    lockFileMaintenance: {
      automerge: true,
    },
    patch: {
      automerge: true,
    },
    pin: {
      automerge: true,
    },
    separateMinorPatch: true,
  },
  automergePr: {
    automergeType: 'pr',
    description: 'Raise a PR first before any automerging.',
  },
  automergeRequireAllStatusChecks: {
    description: 'Require all status checks to pass before any automerging.',
    ignoreTests: false,
  },
  automergeStableNonMajor: {
    description:
      'Automerge non-major upgrades for semver stable packages if they pass tests.',
    packageRules: [
      {
        automerge: true,
        matchCurrentVersion: '>= 1.0.0',
        matchUpdateTypes: ['minor', 'patch'],
      },
    ],
  },
  automergeTesters: {
    description: 'Update testing packages automatically if tests pass.',
    packageRules: [
      {
        automerge: true,
        extends: ['packages:test'],
      },
    ],
  },
  automergeTypes: {
    description: 'Update `@types/*` packages automatically if tests pass.',
    packageRules: [
      {
        automerge: true,
        matchPackagePrefixes: ['@types/'],
      },
    ],
  },
  combinePatchMinorReleases: {
    description:
      'Do not separate `patch` and `minor` upgrades into separate PRs for the same dependency.',
    separateMinorPatch: false,
  },
  dependencyDashboard: {
    dependencyDashboard: true,
    description: 'Enable Renovate Dependency Dashboard creation.',
  },
  dependencyDashboardApproval: {
    dependencyDashboardApproval: true,
    description: 'Enable Renovate Dependency Dashboard approval workflow.',
  },
  disableDependencyDashboard: {
    dependencyDashboard: false,
    description: 'Disable Renovate Dependency Dashboard creation.',
  },
  disableDevDependencies: {
    description: 'Do not update `devDependencies` versions/ranges.',
    packageRules: [
      {
        enabled: false,
        matchDepTypes: ['devDependencies'],
      },
    ],
  },
  disableDigestUpdates: {
    description: 'Disable `digest` and Git hash updates.',
    digest: {
      enabled: false,
    },
  },
  disableDomain: {
    description: 'Disable requests to a particular domain.',
    hostRules: [
      {
        enabled: false,
        matchHost: '{{arg0}}',
      },
    ],
  },
  disableHost: {
    description: 'Disable requests to a particular host.',
    hostRules: [
      {
        enabled: false,
        matchHost: 'https://{{arg0}}',
      },
    ],
  },
  disableLockFiles: {
    description: 'Disable lock file updates.',
    updateLockFiles: false,
  },
  disableMajorUpdates: {
    description: 'Disable `major` updates.',
    major: {
      enabled: false,
    },
  },
  disablePeerDependencies: {
    description: 'Do not update `peerDependencies` versions/ranges.',
    packageRules: [
      {
        enabled: false,
        matchDepTypes: ['peerDependencies'],
      },
    ],
  },
  disablePrControls: {
    description: 'Remove the checkbox controls from PRs.',
    prBodyTemplate:
      '{{{header}}}{{{table}}}{{{notes}}}{{{changelogs}}}{{{configDescription}}}{{{footer}}}',
  },
  disableRateLimiting: {
    description: 'Remove hourly and concurrent rate limits.',
    prConcurrentLimit: 0,
    prHourlyLimit: 0,
  },
  disableRenovate: {
    description: 'Disable Renovate.',
    enabled: false,
  },
  disableVulnerabilityAlerts: {
    description: 'Disable vulnerability alerts completely.',
    vulnerabilityAlerts: {
      enabled: false,
    },
  },
  docker: {
    description: 'Keep Dockerfile `FROM` sources updated.',
    'docker-compose': {
      enabled: true,
    },
    dockerfile: {
      enabled: true,
    },
  },
  doNotPinPackage: {
    description: 'Disable version pinning for `{{arg0}}`.',
    packageRules: [
      {
        matchPackageNames: ['{{arg0}}'],
        rangeStrategy: 'replace',
      },
    ],
  },
  enablePreCommit: {
    description: 'Enable the pre-commit manager.',
    'pre-commit': {
      enabled: true,
    },
  },
  enableRenovate: {
    description: 'Enable Renovate.',
    enabled: true,
  },
  enableVulnerabilityAlerts: {
    description: 'Raise PR when vulnerability alerts are detected.',
    vulnerabilityAlerts: {
      enabled: true,
    },
  },
  enableVulnerabilityAlertsWithLabel: {
    description:
      'Raise PR when vulnerability alerts are detected with label `{{arg0}}`.',
    vulnerabilityAlerts: {
      enabled: true,
      labels: ['{{arg0}}'],
    },
  },
  followTag: {
    description:
      'For package `{{arg0}}`, strictly follow release tag `{{arg1}}`.',
    packageRules: [
      {
        followTag: '{{arg1}}',
        matchPackageNames: ['{{arg0}}'],
      },
    ],
  },
  githubComToken: {
    description:
      'Use provided token for `github.com` lookups. Do not configure this if you are already running on `github.com`.',
    hostRules: [
      {
        encrypted: {
          token: '{{arg0}}',
        },
        matchHost: 'github.com',
      },
    ],
  },
  gitSignOff: {
    commitBody: 'Signed-off-by: {{{gitAuthor}}}',
    description: 'Append `Signed-off-by:` to signoff Git commits.',
  },
  gomod: {
    description: 'Enable Go modules support.',
    gomod: {
      enabled: true,
    },
  },
  group: {
    description: 'Group `{{arg1}}` packages into same branch/PR.',
    packageRules: [
      {
        extends: ['{{arg0}}'],
        groupName: '{{arg1}}',
      },
    ],
  },
  ignoreModulesAndTests: {
    description:
      'Ignore `node_modules`, `bower_components`, `vendor` and various test/tests directories.',
    ignorePaths: [
      '**/node_modules/**',
      '**/bower_components/**',
      '**/vendor/**',
      '**/examples/**',
      '**/__tests__/**',
      '**/test/**',
      '**/tests/**',
      '**/__fixtures__/**',
    ],
  },
  ignoreUnstable: {
    description:
      'Upgrade to unstable versions only if the existing version is unstable.',
    ignoreUnstable: true,
  },
  includeNodeModules: {
    description:
      'Include `package.json` files found within `node_modules` folders or `bower_components`.',
    ignorePaths: [],
  },
  label: {
    description: 'Apply label `{{arg0}}` to PRs.',
    labels: ['{{arg0}}'],
  },
  labels: {
    description: 'Apply labels `{{arg0}}` and `{{arg1}}` to PRs.',
    labels: ['{{arg0}}', '{{arg1}}'],
  },
  maintainLockFilesDisabled: {
    description:
      'Update existing lock files only when `package.json` is modified.',
    lockFileMaintenance: {
      enabled: false,
    },
  },
  maintainLockFilesMonthly: {
    description:
      'Run lock file maintenance (updates) on the first day of each month.',
    lockFileMaintenance: {
      enabled: true,
      extends: ['schedule:monthly'],
    },
  },
  maintainLockFilesWeekly: {
    description: 'Run lock file maintenance (updates) early Monday mornings.',
    lockFileMaintenance: {
      enabled: true,
      extends: ['schedule:weekly'],
    },
  },
  meteor: {
    description: 'Keep Meteor Npm.depends packages updated.',
    meteor: {
      enabled: true,
    },
  },
  noUnscheduledUpdates: {
    description: 'Only update branches when scheduled.',
    updateNotScheduled: false,
  },
  npm: {
    description: 'Keep `package.json` npm dependencies updated.',
    npm: {
      enabled: true,
    },
  },
  pathSemanticCommitType: {
    description:
      'Use semanticCommitType `{{arg1}}` for all package files matching path `{{arg0}}`.',
    packageRules: [
      {
        matchFileNames: ['{{arg0}}'],
        semanticCommitType: '{{arg1}}',
      },
    ],
  },
  pinAllExceptPeerDependencies: {
    description: 'Pin all dependency versions except `peerDependencies`.',
    packageRules: [
      {
        matchPackagePatterns: ['*'],
        rangeStrategy: 'pin',
      },
      {
        matchDepTypes: ['engines', 'peerDependencies'],
        rangeStrategy: 'auto',
      },
    ],
  },
  pinDependencies: {
    description:
      'Pin dependency versions where `depType=dependencies`. Usually applies only to non-dev dependencies in `package.json`.',
    packageRules: [
      {
        matchDepTypes: ['dependencies'],
        rangeStrategy: 'pin',
      },
    ],
  },
  pinDevDependencies: {
    description: 'Pin dependency versions for `devDependencies`.',
    packageRules: [
      {
        matchDepTypes: ['devDependencies'],
        rangeStrategy: 'pin',
      },
    ],
  },
  pinDigestsDisabled: {
    description: 'Disable pinning of Docker dependency digests.',
    pinDigests: false,
  },
  pinOnlyDevDependencies: {
    description:
      'Pin dependency versions for `devDependencies` and retain SemVer ranges for others.',
    packageRules: [
      {
        matchPackagePatterns: ['*'],
        rangeStrategy: 'replace',
      },
      {
        matchDepTypes: ['devDependencies'],
        rangeStrategy: 'pin',
      },
      {
        matchDepTypes: ['peerDependencies'],
        rangeStrategy: 'widen',
      },
    ],
  },
  pinSkipCi: {
    description: 'Add `[skip ci]` to commit message body whenever pinning.',
    pin: {
      commitBody: '[skip ci]',
    },
  },
  pinVersions: {
    description:
      'Use version pinning (maintain a single version only and not SemVer ranges).',
    rangeStrategy: 'pin',
  },
  prConcurrentLimit10: {
    description: 'Limit to maximum 10 open PRs at any time.',
    prConcurrentLimit: 10,
  },
  prConcurrentLimit20: {
    description: 'Limit to maximum 20 open PRs at any time.',
    prConcurrentLimit: 20,
  },
  prConcurrentLimitNone: {
    description: 'Remove limit for open PRs at any time.',
    prConcurrentLimit: 0,
  },
  preserveSemverRanges: {
    description:
      'Preserve (but continue to upgrade) any existing SemVer ranges.',
    packageRules: [{ matchPackagePatterns: ['*'], rangeStrategy: 'replace' }],
  },
  prHourlyLimit1: {
    description: 'Rate limit PR creation to a maximum of one per hour.',
    prHourlyLimit: 1,
  },
  prHourlyLimit2: {
    description: 'Rate limit PR creation to a maximum of two per hour.',
    prHourlyLimit: 2,
  },
  prHourlyLimit4: {
    description: 'Rate limit PR creation to a maximum of four per hour.',
    prHourlyLimit: 4,
  },
  prHourlyLimitNone: {
    description: 'Removes rate limit for PR creation per hour.',
    prHourlyLimit: 0,
  },
  prImmediately: {
    description: 'Raise PRs immediately (after branch is created).',
    prCreation: 'immediate',
  },
  prNotPending: {
    description:
      'Wait for branch tests to pass or fail before creating the PR.',
    prCreation: 'not-pending',
  },
  rebaseStalePrs: {
    description:
      'Rebase existing PRs any time the base branch has been updated.',
    rebaseWhen: 'behind-base-branch',
  },
  renovatePrefix: {
    branchPrefix: 'renovate/',
    description: 'Add the `renovate/` prefix to all branch names.',
  },
  respectLatest: {
    description: 'Upgrade versions up to the "latest" tag in the npm registry.',
    respectLatest: true,
  },
  reviewer: {
    description: 'Add `{{arg0}}` as reviewer for PRs.',
    reviewers: ['{{arg0}}'],
  },
  semanticCommits: {
    description: 'Use semantic prefixes for commit messages and PR titles.',
    semanticCommits: 'enabled',
  },
  semanticCommitScope: {
    description:
      'Use semantic commit scope `{{arg0}}` for all commits and PR titles.',
    semanticCommitScope: '{{arg0}}',
  },
  semanticCommitScopeDisabled: {
    description: 'Disable semantic commit scope for all commits and PR titles.',
    semanticCommitScope: null,
  },
  semanticCommitsDisabled: {
    description: 'Disable semantic prefixes for commit messages and PR titles.',
    semanticCommits: 'disabled',
  },
  semanticCommitType: {
    description:
      'Use `{{arg0}}` as semantic commit type for commit messages and PR titles.',
    semanticCommitType: '{{arg0}}',
  },
  semanticCommitTypeAll: {
    description:
      'If Renovate detects semantic commits, it will use semantic commit type `{{arg0}}` for all commits.',
    packageRules: [
      {
        matchFileNames: ['**/*'],
        semanticCommitType: '{{arg0}}',
      },
    ],
  },
  semanticPrefixChore: {
    description:
      'Use `chore` as semantic commit type for commit messages and PR titles.',
    extends: [':semanticCommitType(chore)'],
  },
  semanticPrefixFix: {
    description:
      'Use `fix` as semantic commit type for commit messages and PR titles.',
    extends: [':semanticCommitType(fix)'],
  },
  semanticPrefixFixDepsChoreOthers: {
    description:
      'Use semantic commit type `fix` for dependencies and `chore` for all others if semantic commits are in use.',
    packageRules: [
      {
        matchPackagePatterns: ['*'],
        semanticCommitType: 'chore',
      },
      {
        matchDepTypes: ['dependencies', 'require'],
        semanticCommitType: 'fix',
      },
      {
        matchDatasources: ['maven'],
        matchDepTypes: [
          'compile',
          'provided',
          'runtime',
          'system',
          'import',
          'parent',
        ],
        semanticCommitType: 'fix',
      },
    ],
  },
  separateMajorReleases: {
    description:
      'Separate `major` versions of dependencies into individual branches/PRs.',
    separateMajorMinor: true,
  },
  separateMultipleMajorReleases: {
    description:
      'Separate each `major` version of dependencies into individual branches/PRs.',
    separateMajorMinor: true,
    separateMultipleMajor: true,
  },
  separateMultipleMinorReleases: {
    description:
      'Separate each `minor` version of dependencies into individual branches/PRs.',
    separateMultipleMinor: true,
  },
  separatePatchReleases: {
    description:
      'Separate `patch` and `minor` releases of dependencies into separate PRs.',
    separateMinorPatch: true,
  },
  skipStatusChecks: {
    description: 'Skip status checks and automerge right away.',
    ignoreTests: true,
  },
  timezone: {
    description: 'Evaluate schedules according to timezone `{{arg0}}`.',
    timezone: '{{arg0}}',
  },
  updateNotScheduled: {
    description: 'Keep existing branches updated even when not scheduled.',
    updateNotScheduled: true,
  },
  widenPeerDependencies: {
    description:
      'Always widen `peerDependencies` SemVer ranges when updating, instead of replacing.',
    packageRules: [
      {
        matchDepTypes: ['peerDependencies'],
        rangeStrategy: 'widen',
      },
    ],
  },
};
