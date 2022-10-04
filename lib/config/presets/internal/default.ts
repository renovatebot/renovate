import { _ } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  enableRenovate: {
    description: _('Enable Renovate.'),
    enabled: true,
  },
  disableRenovate: {
    description: _('Disable Renovate.'),
    enabled: false,
  },
  disableMajorUpdates: {
    description: _('Disable `major` updates.'),
    major: {
      enabled: false,
    },
  },
  disableDomain: {
    description: _('Disable requests to a particular domain.'),
    hostRules: [
      {
        matchHost: '{{arg0}}',
        enabled: false,
      },
    ],
  },
  disableHost: {
    description: _('Disable requests to a particular host.'),
    hostRules: [
      {
        matchHost: 'https://{{arg0}}',
        enabled: false,
      },
    ],
  },
  enablePreCommit: {
    description: _('Enable the pre-commit manager.'),
    'pre-commit': {
      enabled: true,
    },
  },
  ignoreModulesAndTests: {
    description: _(
      'Ignore `node_modules`, `bower_components`, `vendor` and various test/tests directories.'
    ),
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
    description: _(
      'Include `package.json` files found within `node_modules` folders or `bower_components`.'
    ),
    ignorePaths: [],
  },
  pinVersions: {
    description: _(
      'Use version pinning (maintain a single version only and not SemVer ranges).'
    ),
    rangeStrategy: 'pin',
  },
  preserveSemverRanges: {
    description: _(
      'Preserve (but continue to upgrade) any existing SemVer ranges.'
    ),
    packageRules: [{ matchPackagePatterns: ['*'], rangeStrategy: 'replace' }],
  },
  pinAllExceptPeerDependencies: {
    description: _('Pin all dependency versions except `peerDependencies`.'),
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
    description: _(
      'Pin dependency versions where `depType=dependencies`. Usually applies only to non-dev dependencies in `package.json`.'
    ),
    packageRules: [
      {
        matchDepTypes: ['dependencies'],
        rangeStrategy: 'pin',
      },
    ],
  },
  pinDevDependencies: {
    description: _('Pin dependency versions for `devDependencies`.'),
    packageRules: [
      {
        matchDepTypes: ['devDependencies'],
        rangeStrategy: 'pin',
      },
    ],
  },
  pinOnlyDevDependencies: {
    description: _(
      'Pin dependency versions for `devDependencies` and retain SemVer ranges for others.'
    ),
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
    description: _(
      'Autodetect whether to pin dependencies or maintain ranges.'
    ),
    rangeStrategy: 'auto',
  },
  separateMajorReleases: {
    description: _(
      'Separate `major` versions of dependencies into individual branches/PRs.'
    ),
    separateMajorMinor: true,
  },
  separateMultipleMajorReleases: {
    description: _(
      'Separate each `major` version of dependencies into individual branches/PRs.'
    ),
    separateMajorMinor: true,
    separateMultipleMajor: true,
  },
  separatePatchReleases: {
    description: _(
      'Separate `patch` and `minor` releases of dependencies into separate PRs.'
    ),
    separateMinorPatch: true,
  },
  combinePatchMinorReleases: {
    description: _(
      'Do not separate `patch` and `minor` upgrades into separate PRs for the same dependency.'
    ),
    separateMinorPatch: false,
  },
  renovatePrefix: {
    description: _('Prefix `renovate/` to all branch names.'),
    branchPrefix: 'renovate/',
  },
  semanticCommitType: {
    description: _(
      'Use `{{arg0}}` as semantic commit type for commit messages and PR titles.'
    ),
    semanticCommitType: '{{arg0}}',
  },
  semanticPrefixChore: {
    description: _(
      'Use `chore` as semantic commit type for commit messages and PR titles.'
    ),
    extends: [':semanticCommitType(chore)'],
  },
  semanticPrefixFix: {
    description: _(
      'Use `fix` as semantic commit type for commit messages and PR titles.'
    ),
    extends: [':semanticCommitType(fix)'],
  },
  disablePeerDependencies: {
    description: _('Do not renovate `peerDependencies` versions/ranges.'),
    packageRules: [
      {
        matchDepTypes: ['peerDependencies'],
        enabled: false,
      },
    ],
  },
  disableDevDependencies: {
    description: _('Do not renovate `devDependencies` versions/ranges.'),
    packageRules: [
      {
        matchDepTypes: ['devDependencies'],
        enabled: false,
      },
    ],
  },
  disableDigestUpdates: {
    description: _('Disable `digest` and Git hash updates.'),
    digest: {
      enabled: false,
    },
  },
  semanticPrefixFixDepsChoreOthers: {
    description: _(
      'If Renovate detects semantic commits, it will use semantic commit type `fix` for dependencies and `chore` for all others.'
    ),
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
  semanticCommitTypeAll: {
    description: _(
      'If Renovate detects semantic commits, it will use semantic commit type `{{arg0}}` for all commits.'
    ),
    packageRules: [
      {
        matchPackagePatterns: ['*'],
        semanticCommitType: '{{arg0}}',
      },
    ],
  },
  rebaseStalePrs: {
    description: _(
      'Rebase existing PRs any time the base branch has been updated.'
    ),
    rebaseWhen: 'behind-base-branch',
  },
  prImmediately: {
    description: _('Raise PRs immediately (after branch is created).'),
    prCreation: 'immediate',
  },
  prNotPending: {
    description: _(
      'Wait for branch tests to pass or fail before creating the PR.'
    ),
    prCreation: 'not-pending',
  },
  prHourlyLimitNone: {
    description: _('Removes rate limit for PR creation per hour.'),
    prHourlyLimit: 0,
  },
  prHourlyLimit1: {
    description: _('Rate limit PR creation to a maximum of one per hour.'),
    prHourlyLimit: 1,
  },
  prHourlyLimit2: {
    description: _('Rate limit PR creation to a maximum of two per hour.'),
    prHourlyLimit: 2,
  },
  prHourlyLimit4: {
    description: _('Rate limit PR creation to a maximum of four per hour.'),
    prHourlyLimit: 4,
  },
  prConcurrentLimitNone: {
    description: _('Remove limit for open PRs at any time.'),
    prConcurrentLimit: 0,
  },
  prConcurrentLimit10: {
    description: _('Limit to maximum 10 open PRs at any time.'),
    prConcurrentLimit: 10,
  },
  prConcurrentLimit20: {
    description: _('Limit to maximum 20 open PRs at any time.'),
    prConcurrentLimit: 20,
  },
  disableRateLimiting: {
    description: _('Remove hourly and concurrent rate limits.'),
    prConcurrentLimit: 0,
    prHourlyLimit: 0,
  },
  automergeDisabled: {
    description: _(
      'Disable automerging feature - wait for humans to merge all PRs.'
    ),
    automerge: false,
  },
  automergeDigest: {
    description: _('Automerge `digest` upgrades if they pass tests.'),
    digest: {
      automerge: true,
    },
  },
  automergePatch: {
    description: _('Automerge `patch` upgrades if they pass tests.'),
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
    description: _(
      'Automerge `patch` and `minor` upgrades if they pass tests.'
    ),
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
    description: _(
      'Automerge all upgrades (including `major`) if they pass tests.'
    ),
    automerge: true,
  },
  automergeAll: {
    description: _(
      'Automerge all upgrades (including `major`) if they pass tests.'
    ),
    automerge: true,
  },
  automergeBranch: {
    description: _(
      'If automerging, push the new commit directly to the base branch (no PR).'
    ),
    automergeType: 'branch',
  },
  automergePr: {
    description: _('Raise a PR first before any automerging.'),
    automergeType: 'pr',
  },
  automergeRequireAllStatusChecks: {
    description: _('Require all status checks to pass before any automerging.'),
    ignoreTests: false,
  },
  skipStatusChecks: {
    description: _('Skip status checks and automerge right away.'),
    ignoreTests: true,
  },
  maintainLockFilesDisabled: {
    description: _(
      'Update existing lock files only when `package.json` is modified.'
    ),
    lockFileMaintenance: {
      enabled: false,
    },
  },
  pinDigestsDisabled: {
    description: _('Disable pinning of Docker dependency digests.'),
    pinDigests: false,
  },
  maintainLockFilesWeekly: {
    description: _(
      'Run lock file maintenance (updates) early Monday mornings.'
    ),
    lockFileMaintenance: {
      enabled: true,
      extends: ['schedule:weekly'],
    },
  },
  maintainLockFilesMonthly: {
    description: _(
      'Run lock file maintenance (updates) on the first day of each month.'
    ),
    lockFileMaintenance: {
      enabled: true,
      extends: ['schedule:monthly'],
    },
  },
  ignoreUnstable: {
    description: _(
      'Upgrade to unstable versions only if the existing version is unstable.'
    ),
    ignoreUnstable: true,
  },
  respectLatest: {
    description: _(
      'Upgrade versions up to the "latest" tag in the npm registry.'
    ),
    respectLatest: true,
  },
  updateNotScheduled: {
    description: _('Keep existing branches updated even when not scheduled.'),
    updateNotScheduled: true,
  },
  noUnscheduledUpdates: {
    description: _('Only update branches when scheduled.'),
    updateNotScheduled: false,
  },
  automergeLinters: {
    description: _('Update lint packages automatically if tests pass.'),
    packageRules: [
      {
        extends: ['packages:linters'],
        automerge: true,
      },
    ],
  },
  automergeTesters: {
    description: _('Update testing packages automatically if tests pass.'),
    packageRules: [
      {
        extends: ['packages:test'],
        automerge: true,
      },
    ],
  },
  automergeTypes: {
    description: _('Update `@types/*` packages automatically if tests pass.'),
    packageRules: [
      {
        matchPackagePrefixes: ['@types/'],
        automerge: true,
      },
    ],
  },
  doNotPinPackage: {
    description: _('Disable version pinning for `{{arg0}}`.'),
    packageRules: [
      {
        matchPackageNames: ['{{arg0}}'],
        rangeStrategy: 'replace',
      },
    ],
  },
  pinSkipCi: {
    description: _('Add `[skip ci]` to commit message body whenever pinning.'),
    pin: {
      commitBody: '[skip ci]',
    },
  },
  gitSignOff: {
    description: _('Append `Signed-off-by:` to signoff Git commits.'),
    commitBody: 'Signed-off-by: {{{gitAuthor}}}',
  },
  npm: {
    description: _('Keep `package.json` npm dependencies updated.'),
    npm: {
      enabled: true,
    },
  },
  gomod: {
    description: _('Enable Go modules support.'),
    gomod: {
      enabled: true,
    },
  },
  onlyNpm: {
    description: _('Renovate only npm dependencies.'),
    docker: {
      enabled: false,
    },
    meteor: {
      enabled: false,
    },
  },
  docker: {
    description: _('Keep Dockerfile `FROM` sources updated.'),
    docker: {
      enabled: true,
    },
  },
  meteor: {
    description: _('Keep Meteor Npm.depends packages updated.'),
    meteor: {
      enabled: true,
    },
  },
  group: {
    description: _('Group `{{arg1}}` packages into same branch/PR.'),
    packageRules: [
      {
        extends: ['{{arg0}}'],
        groupName: '{{arg1}}',
      },
    ],
  },
  label: {
    description: _('Apply label `{{arg0}}` to PRs.'),
    labels: ['{{arg0}}'],
  },
  labels: {
    description: _('Apply labels `{{arg0}}` and `{{arg1}}` to PRs.'),
    labels: ['{{arg0}}', '{{arg1}}'],
  },
  assignee: {
    description: _('Assign PRs to `{{arg0}}`.'),
    assignees: ['{{arg0}}'],
  },
  reviewer: {
    description: _('Add `{{arg0}}` as reviewer for PRs.'),
    reviewers: ['{{arg0}}'],
  },
  assignAndReview: {
    description: _('Set `{{arg0}}` as assignee and reviewer of PRs.'),
    extends: [':assignee({{arg0}})', ':reviewer({{arg0}})'],
  },
  enableVulnerabilityAlerts: {
    description: _('Raise PR when vulnerability alerts are detected.'),
    vulnerabilityAlerts: {
      enabled: true,
    },
  },
  enableVulnerabilityAlertsWithLabel: {
    description: _(
      'Raise PR when vulnerability alerts are detected with label `{{arg0}}`.'
    ),
    vulnerabilityAlerts: {
      enabled: true,
      labels: ['{{arg0}}'],
    },
  },
  disableVulnerabilityAlerts: {
    description: _('Disable vulnerability alerts completely.'),
    vulnerabilityAlerts: {
      enabled: false,
    },
  },
  semanticCommits: {
    description: _('Use semantic prefixes for commit messages and PR titles.'),
    semanticCommits: 'enabled',
  },
  semanticCommitsDisabled: {
    description: _(
      'Disable semantic prefixes for commit messages and PR titles.'
    ),
    semanticCommits: 'disabled',
  },
  disableLockFiles: {
    description: _('Disable lock file updates.'),
    updateLockFiles: false,
  },
  semanticCommitScope: {
    description: _(
      'Use semantic commit scope `{{arg0}}` for all commits and PR titles.'
    ),
    semanticCommitScope: '{{arg0}}',
  },
  semanticCommitScopeDisabled: {
    description: _(
      'Disable semantic commit scope for all commits and PR titles.'
    ),
    semanticCommitScope: null,
  },
  widenPeerDependencies: {
    description: _(
      'Always widen `peerDependencies` SemVer ranges when updating, instead of replacing.'
    ),
    packageRules: [
      {
        matchDepTypes: ['peerDependencies'],
        rangeStrategy: 'widen',
      },
    ],
  },
  dependencyDashboard: {
    description: _('Enable Renovate Dependency Dashboard creation.'),
    dependencyDashboard: true,
  },
  disableDependencyDashboard: {
    description: _('Disable Renovate Dependency Dashboard creation.'),
    dependencyDashboard: false,
  },
  dependencyDashboardApproval: {
    description: _('Enable Renovate Dependency Dashboard approval workflow.'),
    dependencyDashboardApproval: true,
  },
  timezone: {
    description: _('Evaluate schedules according to timezone `{{arg0}}`.'),
    timezone: '{{arg0}}',
  },
  pathSemanticCommitType: {
    description: _(
      'Use semanticCommitType `{{arg0}}` for all package files matching path `{{arg1}}`.'
    ),
    packageRules: [
      {
        matchPaths: ['{{arg0}}'],
        semanticCommitType: '{{arg1}}',
      },
    ],
  },
  followTag: {
    description: _(
      'For package `{{arg0}}`, strictly follow release tag `{{arg1}}`.'
    ),
    packageRules: [
      {
        matchPackageNames: ['{{arg0}}'],
        followTag: '{{arg1}}',
      },
    ],
  },
  githubComToken: {
    description: _(
      'Use provided token for `github.com` lookups. Do not configure this if you are already running on `github.com`.'
    ),
    hostRules: [
      {
        matchHost: 'github.com',
        encrypted: {
          token: '{{arg0}}',
        },
      },
    ],
  },
  disablePrControls: {
    description: _('Remove the checkbox controls from PRs.'),
    prBodyTemplate:
      '{{{header}}}{{{table}}}{{{notes}}}{{{changelogs}}}{{{configDescription}}}{{{footer}}}',
  },
};
