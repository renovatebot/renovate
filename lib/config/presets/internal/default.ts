import { gettext } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  enableRenovate: {
    description: gettext('Enable Renovate.'),
    enabled: true,
  },
  disableRenovate: {
    description: gettext('Disable Renovate.'),
    enabled: false,
  },
  disableMajorUpdates: {
    description: gettext('Disable `major` updates.'),
    major: {
      enabled: false,
    },
  },
  disableDomain: {
    description: gettext('Disable requests to a particular domain.'),
    hostRules: [
      {
        matchHost: '{{arg0}}',
        enabled: false,
      },
    ],
  },
  disableHost: {
    description: gettext('Disable requests to a particular host.'),
    hostRules: [
      {
        matchHost: 'https://{{arg0}}',
        enabled: false,
      },
    ],
  },
  enablePreCommit: {
    description: gettext('Enable the pre-commit manager.'),
    'pre-commit': {
      enabled: true,
    },
  },
  ignoreModulesAndTests: {
    description: gettext(
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
    description: gettext(
      'Include `package.json` files found within `node_modules` folders or `bower_components`.'
    ),
    ignorePaths: [],
  },
  pinVersions: {
    description: gettext(
      'Use version pinning (maintain a single version only and not SemVer ranges).'
    ),
    rangeStrategy: 'pin',
  },
  preserveSemverRanges: {
    description: gettext(
      'Preserve (but continue to upgrade) any existing SemVer ranges.'
    ),
    packageRules: [{ matchPackagePatterns: ['*'], rangeStrategy: 'replace' }],
  },
  pinAllExceptPeerDependencies: {
    description: gettext(
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
    description: gettext(
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
    description: gettext('Pin dependency versions for `devDependencies`.'),
    packageRules: [
      {
        matchDepTypes: ['devDependencies'],
        rangeStrategy: 'pin',
      },
    ],
  },
  pinOnlyDevDependencies: {
    description: gettext(
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
    description: gettext(
      'Autodetect whether to pin dependencies or maintain ranges.'
    ),
    rangeStrategy: 'auto',
  },
  separateMajorReleases: {
    description: gettext(
      'Separate `major` versions of dependencies into individual branches/PRs.'
    ),
    separateMajorMinor: true,
  },
  separateMultipleMajorReleases: {
    description: gettext(
      'Separate each `major` version of dependencies into individual branches/PRs.'
    ),
    separateMajorMinor: true,
    separateMultipleMajor: true,
  },
  separatePatchReleases: {
    description: gettext(
      'Separate `patch` and `minor` releases of dependencies into separate PRs.'
    ),
    separateMinorPatch: true,
  },
  combinePatchMinorReleases: {
    description: gettext(
      'Do not separate `patch` and `minor` upgrades into separate PRs for the same dependency.'
    ),
    separateMinorPatch: false,
  },
  renovatePrefix: {
    description: gettext('Prefix `renovate/` to all branch names.'),
    branchPrefix: 'renovate/',
  },
  semanticCommitType: {
    description: gettext(
      'Use `{{arg0}}` as semantic commit type for commit messages and PR titles.'
    ),
    semanticCommitType: '{{arg0}}',
  },
  semanticPrefixChore: {
    description: gettext(
      'Use `chore` as semantic commit type for commit messages and PR titles.'
    ),
    extends: [':semanticCommitType(chore)'],
  },
  semanticPrefixFix: {
    description: gettext(
      'Use `fix` as semantic commit type for commit messages and PR titles.'
    ),
    extends: [':semanticCommitType(fix)'],
  },
  disablePeerDependencies: {
    description: gettext('Do not renovate `peerDependencies` versions/ranges.'),
    packageRules: [
      {
        matchDepTypes: ['peerDependencies'],
        enabled: false,
      },
    ],
  },
  disableDevDependencies: {
    description: gettext('Do not renovate `devDependencies` versions/ranges.'),
    packageRules: [
      {
        matchDepTypes: ['devDependencies'],
        enabled: false,
      },
    ],
  },
  disableDigestUpdates: {
    description: gettext('Disable `digest` and Git hash updates.'),
    digest: {
      enabled: false,
    },
  },
  semanticPrefixFixDepsChoreOthers: {
    description: gettext(
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
    description: gettext(
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
    description: gettext(
      'Rebase existing PRs any time the base branch has been updated.'
    ),
    rebaseWhen: 'behind-base-branch',
  },
  prImmediately: {
    description: gettext('Raise PRs immediately (after branch is created).'),
    prCreation: 'immediate',
  },
  prNotPending: {
    description: gettext(
      'Wait for branch tests to pass or fail before creating the PR.'
    ),
    prCreation: 'not-pending',
  },
  prHourlyLimitNone: {
    description: gettext('Removes rate limit for PR creation per hour.'),
    prHourlyLimit: 0,
  },
  prHourlyLimit1: {
    description: gettext(
      'Rate limit PR creation to a maximum of one per hour.'
    ),
    prHourlyLimit: 1,
  },
  prHourlyLimit2: {
    description: gettext(
      'Rate limit PR creation to a maximum of two per hour.'
    ),
    prHourlyLimit: 2,
  },
  prHourlyLimit4: {
    description: gettext(
      'Rate limit PR creation to a maximum of four per hour.'
    ),
    prHourlyLimit: 4,
  },
  prConcurrentLimitNone: {
    description: gettext('Remove limit for open PRs at any time.'),
    prConcurrentLimit: 0,
  },
  prConcurrentLimit10: {
    description: gettext('Limit to maximum 10 open PRs at any time.'),
    prConcurrentLimit: 10,
  },
  prConcurrentLimit20: {
    description: gettext('Limit to maximum 20 open PRs at any time.'),
    prConcurrentLimit: 20,
  },
  disableRateLimiting: {
    description: gettext('Remove hourly and concurrent rate limits.'),
    prConcurrentLimit: 0,
    prHourlyLimit: 0,
  },
  automergeDisabled: {
    description: gettext(
      'Disable automerging feature - wait for humans to merge all PRs.'
    ),
    automerge: false,
  },
  automergeDigest: {
    description: gettext('Automerge `digest` upgrades if they pass tests.'),
    digest: {
      automerge: true,
    },
  },
  automergePatch: {
    description: gettext('Automerge `patch` upgrades if they pass tests.'),
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
    description: gettext(
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
    description: gettext(
      'Automerge all upgrades (including `major`) if they pass tests.'
    ),
    automerge: true,
  },
  automergeAll: {
    description: gettext(
      'Automerge all upgrades (including `major`) if they pass tests.'
    ),
    automerge: true,
  },
  automergeBranch: {
    description: gettext(
      'If automerging, push the new commit directly to the base branch (no PR).'
    ),
    automergeType: 'branch',
  },
  automergePr: {
    description: gettext('Raise a PR first before any automerging.'),
    automergeType: 'pr',
  },
  automergeRequireAllStatusChecks: {
    description: gettext(
      'Require all status checks to pass before any automerging.'
    ),
    ignoreTests: false,
  },
  skipStatusChecks: {
    description: gettext('Skip status checks and automerge right away.'),
    ignoreTests: true,
  },
  maintainLockFilesDisabled: {
    description: gettext(
      'Update existing lock files only when `package.json` is modified.'
    ),
    lockFileMaintenance: {
      enabled: false,
    },
  },
  pinDigestsDisabled: {
    description: gettext('Disable pinning of Docker dependency digests.'),
    pinDigests: false,
  },
  maintainLockFilesWeekly: {
    description: gettext(
      'Run lock file maintenance (updates) early Monday mornings.'
    ),
    lockFileMaintenance: {
      enabled: true,
      extends: ['schedule:weekly'],
    },
  },
  maintainLockFilesMonthly: {
    description: gettext(
      'Run lock file maintenance (updates) on the first day of each month.'
    ),
    lockFileMaintenance: {
      enabled: true,
      extends: ['schedule:monthly'],
    },
  },
  ignoreUnstable: {
    description: gettext(
      'Upgrade to unstable versions only if the existing version is unstable.'
    ),
    ignoreUnstable: true,
  },
  respectLatest: {
    description: gettext(
      'Upgrade versions up to the "latest" tag in the npm registry.'
    ),
    respectLatest: true,
  },
  updateNotScheduled: {
    description: gettext(
      'Keep existing branches updated even when not scheduled.'
    ),
    updateNotScheduled: true,
  },
  noUnscheduledUpdates: {
    description: gettext('Only update branches when scheduled.'),
    updateNotScheduled: false,
  },
  automergeLinters: {
    description: gettext('Update lint packages automatically if tests pass.'),
    packageRules: [
      {
        extends: ['packages:linters'],
        automerge: true,
      },
    ],
  },
  automergeTesters: {
    description: gettext(
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
    description: gettext(
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
    description: gettext('Disable version pinning for `{{arg0}}`.'),
    packageRules: [
      {
        matchPackageNames: ['{{arg0}}'],
        rangeStrategy: 'replace',
      },
    ],
  },
  pinSkipCi: {
    description: gettext(
      'Add `[skip ci]` to commit message body whenever pinning.'
    ),
    pin: {
      commitBody: '[skip ci]',
    },
  },
  gitSignOff: {
    description: gettext('Append `Signed-off-by:` to signoff Git commits.'),
    commitBody: 'Signed-off-by: {{{gitAuthor}}}',
  },
  npm: {
    description: gettext('Keep `package.json` npm dependencies updated.'),
    npm: {
      enabled: true,
    },
  },
  gomod: {
    description: gettext('Enable Go modules support.'),
    gomod: {
      enabled: true,
    },
  },
  onlyNpm: {
    description: gettext('Renovate only npm dependencies.'),
    docker: {
      enabled: false,
    },
    meteor: {
      enabled: false,
    },
  },
  docker: {
    description: gettext('Keep Dockerfile `FROM` sources updated.'),
    docker: {
      enabled: true,
    },
  },
  meteor: {
    description: gettext('Keep Meteor Npm.depends packages updated.'),
    meteor: {
      enabled: true,
    },
  },
  group: {
    description: gettext('Group `{{arg1}}` packages into same branch/PR.'),
    packageRules: [
      {
        extends: ['{{arg0}}'],
        groupName: '{{arg1}}',
      },
    ],
  },
  label: {
    description: gettext('Apply label `{{arg0}}` to PRs.'),
    labels: ['{{arg0}}'],
  },
  labels: {
    description: gettext('Apply labels `{{arg0}}` and `{{arg1}}` to PRs.'),
    labels: ['{{arg0}}', '{{arg1}}'],
  },
  assignee: {
    description: gettext('Assign PRs to `{{arg0}}`.'),
    assignees: ['{{arg0}}'],
  },
  reviewer: {
    description: gettext('Add `{{arg0}}` as reviewer for PRs.'),
    reviewers: ['{{arg0}}'],
  },
  assignAndReview: {
    description: gettext('Set `{{arg0}}` as assignee and reviewer of PRs.'),
    extends: [':assignee({{arg0}})', ':reviewer({{arg0}})'],
  },
  enableVulnerabilityAlerts: {
    description: gettext('Raise PR when vulnerability alerts are detected.'),
    vulnerabilityAlerts: {
      enabled: true,
    },
  },
  enableVulnerabilityAlertsWithLabel: {
    description: gettext(
      'Raise PR when vulnerability alerts are detected with label `{{arg0}}`.'
    ),
    vulnerabilityAlerts: {
      enabled: true,
      labels: ['{{arg0}}'],
    },
  },
  disableVulnerabilityAlerts: {
    description: gettext('Disable vulnerability alerts completely.'),
    vulnerabilityAlerts: {
      enabled: false,
    },
  },
  semanticCommits: {
    description: gettext(
      'Use semantic prefixes for commit messages and PR titles.'
    ),
    semanticCommits: 'enabled',
  },
  semanticCommitsDisabled: {
    description: gettext(
      'Disable semantic prefixes for commit messages and PR titles.'
    ),
    semanticCommits: 'disabled',
  },
  disableLockFiles: {
    description: gettext('Disable lock file updates.'),
    updateLockFiles: false,
  },
  semanticCommitScope: {
    description: gettext(
      'Use semantic commit scope `{{arg0}}` for all commits and PR titles.'
    ),
    semanticCommitScope: '{{arg0}}',
  },
  semanticCommitScopeDisabled: {
    description: gettext(
      'Disable semantic commit scope for all commits and PR titles.'
    ),
    semanticCommitScope: null,
  },
  widenPeerDependencies: {
    description: gettext(
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
    description: gettext('Enable Renovate Dependency Dashboard creation.'),
    dependencyDashboard: true,
  },
  disableDependencyDashboard: {
    description: gettext('Disable Renovate Dependency Dashboard creation.'),
    dependencyDashboard: false,
  },
  dependencyDashboardApproval: {
    description: gettext(
      'Enable Renovate Dependency Dashboard approval workflow.'
    ),
    dependencyDashboardApproval: true,
  },
  timezone: {
    description: gettext(
      'Evaluate schedules according to timezone `{{arg0}}`.'
    ),
    timezone: '{{arg0}}',
  },
  pathSemanticCommitType: {
    description: gettext(
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
    description: gettext(
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
    description: gettext(
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
    description: gettext('Remove the checkbox controls from PRs.'),
    prBodyTemplate:
      '{{{header}}}{{{table}}}{{{notes}}}{{{changelogs}}}{{{configDescription}}}{{{footer}}}',
  },
};
