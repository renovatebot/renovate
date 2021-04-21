import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  enableRenovate: {
    description: 'Enable renovate',
    enabled: true,
  },
  disableRenovate: {
    description: 'Disable renovate',
    enabled: false,
  },
  disableMajorUpdates: {
    description: 'Disables major updates',
    major: {
      enabled: false,
    },
  },
  disableDomain: {
    description: 'Disable requests to a particular domain',
    hostRules: [
      {
        domainName: '{{arg0}}',
        enabled: false,
      },
    ],
  },
  disableHost: {
    description: 'Disable requests to a particular hostName',
    hostRules: [
      {
        hostName: '{{arg0}}',
        enabled: false,
      },
    ],
  },
  ignoreModulesAndTests: {
    description:
      'Ignore `node_modules`, `bower_components`, `vendor` and various test/tests directories',
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
  includeNodeModules: {
    description:
      'Include <code>package.json</code> files found within <code>node_modules</code> folders or <code>bower_components</code>.',
    ignorePaths: [],
  },
  pinVersions: {
    description:
      'Use version pinning (maintain a single version only and not semver ranges)',
    rangeStrategy: 'pin',
  },
  preserveSemverRanges: {
    description:
      'Preserve (but continue to upgrade) any existing semver ranges',
    rangeStrategy: 'replace',
  },
  pinAllExceptPeerDependencies: {
    description:
      'Pin dependency versions for all except <code>peerDependencies</code>',
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
    description: 'Pin dependency versions for <code>dependencies</code>',
    packageRules: [
      {
        matchDepTypes: ['dependencies'],
        rangeStrategy: 'pin',
      },
    ],
  },
  pinDevDependencies: {
    description: 'Pin dependency versions for <code>devDependencies</code>',
    packageRules: [
      {
        matchDepTypes: ['devDependencies'],
        rangeStrategy: 'pin',
      },
    ],
  },
  pinOnlyDevDependencies: {
    description:
      'Pin dependency versions for <code>devDependencies</code> and retain semver ranges for others',
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
  autodetectPinVersions: {
    description: 'Autodetect whether to pin dependencies or maintain ranges',
    rangeStrategy: 'auto',
  },
  separateMajorReleases: {
    description:
      'Separate major versions of dependencies into individual branches/PRs',
    separateMajorMinor: true,
  },
  separateMultipleMajorReleases: {
    description:
      'Separate each available major versions of dependencies into individual branches/PRs',
    separateMajorMinor: true,
    separateMultipleMajor: true,
  },
  separatePatchReleases: {
    description:
      'Separate patch and minor releases of dependencies into separate PRs',
    separateMinorPatch: true,
  },
  combinePatchMinorReleases: {
    description:
      'Do not separate patch and minor upgrades into separate PRs for the same dependency',
    separateMinorPatch: false,
  },
  renovatePrefix: {
    description: 'Use <code>renovate/</code> as prefix for all branch names',
    branchPrefix: 'renovate/',
  },
  semanticCommitType: {
    description:
      'Use <code>{{arg0}}</code> as semantic commit type for commit messages and PR titles',
    semanticCommitType: '{{arg0}}',
  },
  semanticPrefixChore: {
    description:
      'Use <code>chore</code> as semantic commit type for commit messages and PR titles',
    extends: [':semanticCommitType(chore)'],
  },
  semanticPrefixFix: {
    description:
      'Use <code>fix</code> as semantic commit type for commit messages and PR titles',
    extends: [':semanticCommitType(fix)'],
  },
  disablePeerDependencies: {
    description:
      'Do not renovate <code>peerDependencies</code> versions/ranges',
    packageRules: [
      {
        matchDepTypes: ['peerDependencies'],
        enabled: false,
      },
    ],
  },
  disableDevDependencies: {
    description: 'Do not renovate <code>devDependencies</code> versions/ranges',
    packageRules: [
      {
        matchDepTypes: ['devDependencies'],
        enabled: false,
      },
    ],
  },
  disableDigestUpdates: {
    description: 'Disable digest and git hash updates',
    digest: {
      enabled: false,
    },
  },
  semanticPrefixFixDepsChoreOthers: {
    description:
      'If semantic commits detected, use semantic commit type <code>fix</code> for dependencies and <code>chore</code> for all others',
    packageRules: [
      {
        matchPackagePatterns: ['*'],
        semanticCommitType: 'chore',
      },
      {
        matchDepTypes: ['dependencies', 'require'],
        semanticCommitType: 'fix',
      },
    ],
  },
  semanticCommitTypeAll: {
    description:
      'If semantic commits detected, use semantic commit type <code>{{arg0}}</code> for all',
    packageRules: [
      {
        matchPackagePatterns: ['*'],
        semanticCommitType: '{{arg0}}',
      },
    ],
  },
  rebaseStalePrs: {
    description:
      'Rebase existing PRs any time the base branch has been updated',
    rebaseWhen: 'behind-base-branch',
  },
  prImmediately: {
    description: 'Raise PRs immediately (after branch is created)',
    prCreation: 'immediate',
  },
  prNotPending: {
    description:
      'Wait until branch tests have passed or failed before creating the PR',
    prCreation: 'not-pending',
  },
  prHourlyLimitNone: {
    description: 'Removes rate limit for PR creation per hour',
    prHourlyLimit: 0,
  },
  prHourlyLimit1: {
    description: 'Rate limit PR creation to a maximum of one per hour',
    prHourlyLimit: 1,
  },
  prHourlyLimit2: {
    description: 'Rate limit PR creation to a maximum of two per hour',
    prHourlyLimit: 2,
  },
  prHourlyLimit4: {
    description: 'Rate limit PR creation to a maximum of four per hour',
    prHourlyLimit: 4,
  },
  prConcurrentLimitNone: {
    description: 'Remove limit for open PRs',
    prConcurrentLimit: 0,
  },
  prConcurrentLimit10: {
    description: 'Limit to maximum 10 open PRs',
    prConcurrentLimit: 10,
  },
  prConcurrentLimit20: {
    description: 'Limit to maximum 20 open PRs at any time',
    prConcurrentLimit: 20,
  },
  disableRateLimiting: {
    description: 'Remove hourly and concurrent rate limits',
    prConcurrentLimit: 0,
    prHourlyLimit: 0,
  },
  automergeDisabled: {
    description:
      'Disable automerging feature - wait for humans to merge all PRs',
    automerge: false,
  },
  automergeDigest: {
    description: 'Automerge digest upgrades if they pass tests',
    digest: {
      automerge: true,
    },
  },
  automergePatch: {
    description: 'Automerge patch upgrades if they pass tests',
    separateMinorPatch: true,
    patch: {
      automerge: true,
    },
    pin: {
      automerge: true,
    },
    lockFileMaintenance: {
      automerge: true,
    },
  },
  automergeMinor: {
    description: 'Automerge patch and minor upgrades if they pass tests',
    minor: {
      automerge: true,
    },
    patch: {
      automerge: true,
    },
    pin: {
      automerge: true,
    },
    lockFileMaintenance: {
      automerge: true,
    },
  },
  automergeMajor: {
    description: 'Automerge all upgrades (including major) if they pass tests',
    automerge: true,
  },
  automergeAll: {
    description: 'Automerge all upgrades (including major) if they pass tests',
    automerge: true,
  },
  automergeBranch: {
    description:
      'If automerging, push the new commit directly to base branch (no PR)',
    automergeType: 'branch',
  },
  automergePr: {
    description: 'Raise a PR first before any automerging',
    automergeType: 'pr',
  },
  automergeRequireAllStatusChecks: {
    description: 'Require all status checks to pass before any automerging',
    requiredStatusChecks: [],
  },
  skipStatusChecks: {
    description: 'Skip status checks and automerge right away',
    requiredStatusChecks: null,
  },
  maintainLockFilesDisabled: {
    description:
      'Update existing lock files only when <code>package.json</code> is modified',
    lockFileMaintenance: {
      enabled: false,
    },
  },
  pinDigestsDisabled: {
    description: 'Disable pinning of docker dependency digests',
    pinDigests: false,
  },
  maintainLockFilesWeekly: {
    description: 'Run lock file maintenance (updates) early Monday mornings',
    lockFileMaintenance: {
      enabled: true,
      extends: ['schedule:weekly'],
    },
  },
  maintainLockFilesMonthly: {
    description:
      'Run lock file maintenance (updates) on the first day of each month',
    lockFileMaintenance: {
      enabled: true,
      extends: ['schedule:monthly'],
    },
  },
  ignoreUnstable: {
    description:
      'Upgrade to unstable versions only if the existing version is unstable',
    ignoreUnstable: true,
  },
  respectLatest: {
    description: 'Upgrade versions up to the "latest" tag in npm registry',
    respectLatest: true,
  },
  updateNotScheduled: {
    description: 'Keep existing branches updated even when not scheduled',
    updateNotScheduled: true,
  },
  noUnscheduledUpdates: {
    description: 'Make no updates to branches when not scheduled',
    updateNotScheduled: false,
  },
  automergeLinters: {
    description: 'Update lint packages automatically if tests pass',
    packageRules: [
      {
        extends: ['packages:linters'],
        automerge: true,
      },
    ],
  },
  automergeTesters: {
    description: 'Update testing packages automatically if tests pass',
    packageRules: [
      {
        extends: ['packages:test'],
        automerge: true,
      },
    ],
  },
  automergeTypes: {
    description: 'Update @types/* packages automatically if tests pass',
    packageRules: [
      {
        matchPackagePrefixes: ['@types/'],
        automerge: true,
      },
    ],
  },
  doNotPinPackage: {
    description: 'Disable version pinning for <code>{{arg0}}</code>',
    packageRules: [
      {
        matchPackageNames: ['{{arg0}}'],
        rangeStrategy: 'replace',
      },
    ],
  },
  pinSkipCi: {
    description: 'Add [skip ci] to commit message body whenever pinning',
    pin: {
      commitBody: '[skip ci]',
    },
  },
  gitSignOff: {
    description: 'Append git Signed-off-by signature to git commits.',
    commitBody: 'Signed-off-by: {{{gitAuthor}}}',
  },
  npm: {
    description: 'Keep package.json npm dependencies updated',
    npm: {
      enabled: true,
    },
  },
  gomod: {
    description: 'Enable Go modules support',
    gomod: {
      enabled: true,
    },
  },
  onlyNpm: {
    description: 'Renovate only npm dependencies',
    docker: {
      enabled: false,
    },
    meteor: {
      enabled: false,
    },
  },
  docker: {
    description: 'Keep Dockerfile FROM sources updated',
    docker: {
      enabled: true,
    },
  },
  meteor: {
    description: 'Keep Meteor Npm.depends packages updated',
    meteor: {
      enabled: true,
    },
  },
  group: {
    description: 'Group {{arg1}} packages into same branch/PR',
    packageRules: [
      {
        extends: ['{{arg0}}'],
        groupName: '{{arg1}}',
      },
    ],
  },
  label: {
    description: 'Apply label <code>{{arg0}}</code> to PRs',
    labels: ['{{arg0}}'],
  },
  labels: {
    description:
      'Apply labels <code>{{arg0}}</code> and <code>{{arg1}}</code> to PRs',
    labels: ['{{arg0}}', '{{arg1}}'],
  },
  assignee: {
    description: 'Assign PRs to <code>{{arg0}}</code>',
    assignees: ['{{arg0}}'],
  },
  reviewer: {
    description: 'Add <code>{{arg0}}</code> as reviewer for PRs',
    reviewers: ['{{arg0}}'],
  },
  assignAndReview: {
    description: 'Set <code>{{arg0}}</code> as assignee and reviewer of PRs',
    extends: [':assignee({{arg0}})', ':reviewer({{arg0}})'],
  },
  enableVulnerabilityAlerts: {
    description: 'Raise PR when vulnerability alerts are detected',
    vulnerabilityAlerts: {
      enabled: true,
    },
  },
  enableVulnerabilityAlertsWithLabel: {
    description:
      'Raise PR when vulnerability alerts are detected with label <code>{{arg0}}</code>',
    vulnerabilityAlerts: {
      enabled: true,
      labels: ['{{arg0}}'],
    },
  },
  disableVulnerabilityAlerts: {
    description: 'Disable vulnerability alerts completely',
    vulnerabilityAlerts: {
      enabled: false,
    },
  },
  semanticCommits: {
    description: 'Use semantic prefixes for commit messages and PR titles',
    semanticCommits: 'enabled',
  },
  semanticCommitsDisabled: {
    description: 'Disable semantic prefixes for commit messages and PR titles',
    semanticCommits: 'disabled',
  },
  disableLockFiles: {
    description: 'Disable lock file updates',
    updateLockFiles: false,
  },
  semanticCommitScope: {
    description:
      'Use semantic commit scope <code>{{arg0}}</code> for all commits and PR titles',
    semanticCommitScope: '{{arg0}}',
  },
  semanticCommitScopeDisabled: {
    description: 'Disable semantic commit scope for all commits and PR titles',
    semanticCommitScope: null,
  },
  widenPeerDependencies: {
    description:
      'Always widen peerDependencies semver ranges when updating, instead of replacing',
    packageRules: [
      {
        matchDepTypes: ['peerDependencies'],
        rangeStrategy: 'widen',
      },
    ],
  },
  dependencyDashboard: {
    description: 'Enable Renovate Dependency Dashboard creation',
    dependencyDashboard: true,
  },
  dependencyDashboardApproval: {
    description: 'Enable Renovate Dependency Dashboard approval workflow',
    dependencyDashboardApproval: true,
  },
  timezone: {
    description: 'Evaluate schedules according to timezone {{arg0}}',
    timezone: '{{arg0}}',
  },
  pathSemanticCommitType: {
    description:
      'Use semanticCommitType {{arg0}} for all package files matching path {{arg1}}',
    packageRules: [
      {
        matchPaths: ['{{arg0}}'],
        semanticCommitType: '{{arg1}}',
      },
    ],
  },
  followTag: {
    description:
      'For package <code>{{arg0}}</code>, strictly follow release tag <code>{{arg1}}</code>',
    packageRules: [
      {
        matchPackageNames: ['{{arg0}}'],
        followTag: '{{arg1}}',
      },
    ],
  },
  githubComToken: {
    description: 'Use provided token for github.com lookups',
    hostRules: [
      {
        domainName: 'github.com',
        encrypted: {
          token: '{{arg0}}',
        },
      },
    ],
  },
  disablePrControls: {
    description: 'Remove the checkbox controls from PRs',
    prBodyTemplate:
      '{{{header}}}{{{table}}}{{{notes}}}{{{changelogs}}}{{{configDescription}}}{{{footer}}}',
  },
  enableGradleLite: {
    description: 'Enable the gradle-lite manager',
    'gradle-lite': {
      enabled: true,
    },
  },
  switchToGradleLite: {
    description: 'Enable the gradle-lite manager and disable gradle',
    gradle: {
      enabled: false,
    },
    'gradle-lite': {
      enabled: true,
    },
  },
};
