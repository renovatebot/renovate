import { gt } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  enableRenovate: {
    description: gt.gettext('Enable Renovate.'),
    enabled: true,
  },
  disableRenovate: {
    description: gt.gettext('Disable Renovate.'),
    enabled: false,
  },
  disableMajorUpdates: {
    description: gt.gettext('Disable `major` updates.'),
    major: {
      enabled: false,
    },
  },
  disableDomain: {
    description: gt.gettext('Disable requests to a particular domain.'),
    hostRules: [
      {
        matchHost: '{{arg0}}',
        enabled: false,
      },
    ],
  },
  disableHost: {
    description: gt.gettext('Disable requests to a particular host.'),
    hostRules: [
      {
        matchHost: 'https://{{arg0}}',
        enabled: false,
      },
    ],
  },
  enablePreCommit: {
    description: gt.gettext('Enable the pre-commit manager.'),
    'pre-commit': {
      enabled: true,
    },
  },
  ignoreModulesAndTests: {
    description: gt.gettext(
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
    description: gt.gettext(
      'Include `package.json` files found within `node_modules` folders or `bower_components`.'
    ),
    ignorePaths: [],
  },
  pinVersions: {
    description: gt.gettext(
      'Use version pinning (maintain a single version only and not SemVer ranges).'
    ),
    rangeStrategy: 'pin',
  },
  preserveSemverRanges: {
    description: gt.gettext(
      'Preserve (but continue to upgrade) any existing SemVer ranges.'
    ),
    packageRules: [{ matchPackagePatterns: ['*'], rangeStrategy: 'replace' }],
  },
  pinAllExceptPeerDependencies: {
    description: gt.gettext(
      'Pin all dependency versions except `peerDependencies`.'
    ),
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
    description: gt.gettext(
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
    description: gt.gettext('Pin dependency versions for `devDependencies`.'),
    packageRules: [
      {
        matchDepTypes: ['devDependencies'],
        rangeStrategy: 'pin',
      },
    ],
  },
  pinOnlyDevDependencies: {
    description: gt.gettext(
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
    description: gt.gettext(
      'Autodetect whether to pin dependencies or maintain ranges.'
    ),
    rangeStrategy: 'auto',
  },
  separateMajorReleases: {
    description: gt.gettext(
      'Separate `major` versions of dependencies into individual branches/PRs.'
    ),
    separateMajorMinor: true,
  },
  separateMultipleMajorReleases: {
    description: gt.gettext(
      'Separate each `major` version of dependencies into individual branches/PRs.'
    ),
    separateMajorMinor: true,
    separateMultipleMajor: true,
  },
  separatePatchReleases: {
    description: gt.gettext(
      'Separate `patch` and `minor` releases of dependencies into separate PRs.'
    ),
    separateMinorPatch: true,
  },
  combinePatchMinorReleases: {
    description: gt.gettext(
      'Do not separate `patch` and `minor` upgrades into separate PRs for the same dependency.'
    ),
    separateMinorPatch: false,
  },
  renovatePrefix: {
    description: gt.gettext('Prefix `renovate/` to all branch names.'),
    branchPrefix: 'renovate/',
  },
  semanticCommitType: {
    description: gt.gettext(
      'Use `{{arg0}}` as semantic commit type for commit messages and PR titles.'
    ),
    semanticCommitType: '{{arg0}}',
  },
  semanticPrefixChore: {
    description: gt.gettext(
      'Use `chore` as semantic commit type for commit messages and PR titles.'
    ),
    extends: [':semanticCommitType(chore)'],
  },
  semanticPrefixFix: {
    description: gt.gettext(
      'Use `fix` as semantic commit type for commit messages and PR titles.'
    ),
    extends: [':semanticCommitType(fix)'],
  },
  disablePeerDependencies: {
    description: gt.gettext(
      'Do not renovate `peerDependencies` versions/ranges.'
    ),
    packageRules: [
      {
        matchDepTypes: ['peerDependencies'],
        enabled: false,
      },
    ],
  },
  disableDevDependencies: {
    description: gt.gettext(
      'Do not renovate `devDependencies` versions/ranges.'
    ),
    packageRules: [
      {
        matchDepTypes: ['devDependencies'],
        enabled: false,
      },
    ],
  },
  disableDigestUpdates: {
    description: gt.gettext('Disable `digest` and Git hash updates.'),
    digest: {
      enabled: false,
    },
  },
  semanticPrefixFixDepsChoreOthers: {
    description: gt.gettext(
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
    description: gt.gettext(
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
    description: gt.gettext(
      'Rebase existing PRs any time the base branch has been updated.'
    ),
    rebaseWhen: 'behind-base-branch',
  },
  prImmediately: {
    description: gt.gettext('Raise PRs immediately (after branch is created).'),
    prCreation: 'immediate',
  },
  prNotPending: {
    description: gt.gettext(
      'Wait for branch tests to pass or fail before creating the PR.'
    ),
    prCreation: 'not-pending',
  },
  prHourlyLimitNone: {
    description: gt.gettext('Removes rate limit for PR creation per hour.'),
    prHourlyLimit: 0,
  },
  prHourlyLimit1: {
    description: gt.gettext(
      'Rate limit PR creation to a maximum of one per hour.'
    ),
    prHourlyLimit: 1,
  },
  prHourlyLimit2: {
    description: gt.gettext(
      'Rate limit PR creation to a maximum of two per hour.'
    ),
    prHourlyLimit: 2,
  },
  prHourlyLimit4: {
    description: gt.gettext(
      'Rate limit PR creation to a maximum of four per hour.'
    ),
    prHourlyLimit: 4,
  },
  prConcurrentLimitNone: {
    description: gt.gettext('Remove limit for open PRs at any time.'),
    prConcurrentLimit: 0,
  },
  prConcurrentLimit10: {
    description: gt.gettext('Limit to maximum 10 open PRs at any time.'),
    prConcurrentLimit: 10,
  },
  prConcurrentLimit20: {
    description: gt.gettext('Limit to maximum 20 open PRs at any time.'),
    prConcurrentLimit: 20,
  },
  disableRateLimiting: {
    description: gt.gettext('Remove hourly and concurrent rate limits.'),
    prConcurrentLimit: 0,
    prHourlyLimit: 0,
  },
  automergeDisabled: {
    description: gt.gettext(
      'Disable automerging feature - wait for humans to merge all PRs.'
    ),
    automerge: false,
  },
  automergeDigest: {
    description: gt.gettext('Automerge `digest` upgrades if they pass tests.'),
    digest: {
      automerge: true,
    },
  },
  automergePatch: {
    description: gt.gettext('Automerge `patch` upgrades if they pass tests.'),
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
    description: gt.gettext(
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
    description: gt.gettext(
      'Automerge all upgrades (including `major`) if they pass tests.'
    ),
    automerge: true,
  },
  automergeAll: {
    description: gt.gettext(
      'Automerge all upgrades (including `major`) if they pass tests.'
    ),
    automerge: true,
  },
  automergeBranch: {
    description: gt.gettext(
      'If automerging, push the new commit directly to the base branch (no PR).'
    ),
    automergeType: 'branch',
  },
  automergePr: {
    description: gt.gettext('Raise a PR first before any automerging.'),
    automergeType: 'pr',
  },
  automergeRequireAllStatusChecks: {
    description: gt.gettext(
      'Require all status checks to pass before any automerging.'
    ),
    ignoreTests: false,
  },
  skipStatusChecks: {
    description: gt.gettext('Skip status checks and automerge right away.'),
    ignoreTests: true,
  },
  maintainLockFilesDisabled: {
    description: gt.gettext(
      'Update existing lock files only when `package.json` is modified.'
    ),
    lockFileMaintenance: {
      enabled: false,
    },
  },
  pinDigestsDisabled: {
    description: gt.gettext('Disable pinning of Docker dependency digests.'),
    pinDigests: false,
  },
  maintainLockFilesWeekly: {
    description: gt.gettext(
      'Run lock file maintenance (updates) early Monday mornings.'
    ),
    lockFileMaintenance: {
      enabled: true,
      extends: ['schedule:weekly'],
    },
  },
  maintainLockFilesMonthly: {
    description: gt.gettext(
      'Run lock file maintenance (updates) on the first day of each month.'
    ),
    lockFileMaintenance: {
      enabled: true,
      extends: ['schedule:monthly'],
    },
  },
  ignoreUnstable: {
    description: gt.gettext(
      'Upgrade to unstable versions only if the existing version is unstable.'
    ),
    ignoreUnstable: true,
  },
  respectLatest: {
    description: gt.gettext(
      'Upgrade versions up to the "latest" tag in the npm registry.'
    ),
    respectLatest: true,
  },
  updateNotScheduled: {
    description: gt.gettext(
      'Keep existing branches updated even when not scheduled.'
    ),
    updateNotScheduled: true,
  },
  noUnscheduledUpdates: {
    description: gt.gettext('Only update branches when scheduled.'),
    updateNotScheduled: false,
  },
  automergeLinters: {
    description: gt.gettext(
      'Update lint packages automatically if tests pass.'
    ),
    packageRules: [
      {
        extends: ['packages:linters'],
        automerge: true,
      },
    ],
  },
  automergeTesters: {
    description: gt.gettext(
      'Update testing packages automatically if tests pass.'
    ),
    packageRules: [
      {
        extends: ['packages:test'],
        automerge: true,
      },
    ],
  },
  automergeTypes: {
    description: gt.gettext(
      'Update `@types/*` packages automatically if tests pass.'
    ),
    packageRules: [
      {
        matchPackagePrefixes: ['@types/'],
        automerge: true,
      },
    ],
  },
  doNotPinPackage: {
    description: gt.gettext('Disable version pinning for `{{arg0}}`.'),
    packageRules: [
      {
        matchPackageNames: ['{{arg0}}'],
        rangeStrategy: 'replace',
      },
    ],
  },
  pinSkipCi: {
    description: gt.gettext(
      'Add `[skip ci]` to commit message body whenever pinning.'
    ),
    pin: {
      commitBody: '[skip ci]',
    },
  },
  gitSignOff: {
    description: gt.gettext('Append `Signed-off-by:` to signoff Git commits.'),
    commitBody: 'Signed-off-by: {{{gitAuthor}}}',
  },
  npm: {
    description: gt.gettext('Keep `package.json` npm dependencies updated.'),
    npm: {
      enabled: true,
    },
  },
  gomod: {
    description: gt.gettext('Enable Go modules support.'),
    gomod: {
      enabled: true,
    },
  },
  onlyNpm: {
    description: gt.gettext('Renovate only npm dependencies.'),
    docker: {
      enabled: false,
    },
    meteor: {
      enabled: false,
    },
  },
  docker: {
    description: gt.gettext('Keep Dockerfile `FROM` sources updated.'),
    docker: {
      enabled: true,
    },
  },
  meteor: {
    description: gt.gettext('Keep Meteor Npm.depends packages updated.'),
    meteor: {
      enabled: true,
    },
  },
  group: {
    description: gt.gettext('Group `{{arg1}}` packages into same branch/PR.'),
    packageRules: [
      {
        extends: ['{{arg0}}'],
        groupName: '{{arg1}}',
      },
    ],
  },
  label: {
    description: gt.gettext('Apply label `{{arg0}}` to PRs.'),
    labels: ['{{arg0}}'],
  },
  labels: {
    description: gt.gettext('Apply labels `{{arg0}}` and `{{arg1}}` to PRs.'),
    labels: ['{{arg0}}', '{{arg1}}'],
  },
  assignee: {
    description: gt.gettext('Assign PRs to `{{arg0}}`.'),
    assignees: ['{{arg0}}'],
  },
  reviewer: {
    description: gt.gettext('Add `{{arg0}}` as reviewer for PRs.'),
    reviewers: ['{{arg0}}'],
  },
  assignAndReview: {
    description: gt.gettext('Set `{{arg0}}` as assignee and reviewer of PRs.'),
    extends: [':assignee({{arg0}})', ':reviewer({{arg0}})'],
  },
  enableVulnerabilityAlerts: {
    description: gt.gettext('Raise PR when vulnerability alerts are detected.'),
    vulnerabilityAlerts: {
      enabled: true,
    },
  },
  enableVulnerabilityAlertsWithLabel: {
    description: gt.gettext(
      'Raise PR when vulnerability alerts are detected with label `{{arg0}}`.'
    ),
    vulnerabilityAlerts: {
      enabled: true,
      labels: ['{{arg0}}'],
    },
  },
  disableVulnerabilityAlerts: {
    description: gt.gettext('Disable vulnerability alerts completely.'),
    vulnerabilityAlerts: {
      enabled: false,
    },
  },
  semanticCommits: {
    description: gt.gettext(
      'Use semantic prefixes for commit messages and PR titles.'
    ),
    semanticCommits: 'enabled',
  },
  semanticCommitsDisabled: {
    description: gt.gettext(
      'Disable semantic prefixes for commit messages and PR titles.'
    ),
    semanticCommits: 'disabled',
  },
  disableLockFiles: {
    description: gt.gettext('Disable lock file updates.'),
    updateLockFiles: false,
  },
  semanticCommitScope: {
    description: gt.gettext(
      'Use semantic commit scope `{{arg0}}` for all commits and PR titles.'
    ),
    semanticCommitScope: '{{arg0}}',
  },
  semanticCommitScopeDisabled: {
    description: gt.gettext(
      'Disable semantic commit scope for all commits and PR titles.'
    ),
    semanticCommitScope: null,
  },
  widenPeerDependencies: {
    description: gt.gettext(
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
    description: gt.gettext('Enable Renovate Dependency Dashboard creation.'),
    dependencyDashboard: true,
  },
  disableDependencyDashboard: {
    description: gt.gettext('Disable Renovate Dependency Dashboard creation.'),
    dependencyDashboard: false,
  },
  dependencyDashboardApproval: {
    description: gt.gettext(
      'Enable Renovate Dependency Dashboard approval workflow.'
    ),
    dependencyDashboardApproval: true,
  },
  timezone: {
    description: gt.gettext(
      'Evaluate schedules according to timezone `{{arg0}}`.'
    ),
    timezone: '{{arg0}}',
  },
  pathSemanticCommitType: {
    description: gt.gettext(
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
    description: gt.gettext(
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
    description: gt.gettext(
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
    description: gt.gettext('Remove the checkbox controls from PRs.'),
    prBodyTemplate:
      '{{{header}}}{{{table}}}{{{notes}}}{{{changelogs}}}{{{configDescription}}}{{{footer}}}',
  },
};
