module.exports = {
  enableRenovate: {
    description: 'Enable renovate',
    enabled: true,
  },
  disableRenovate: {
    description: 'Disable renovate',
    enabled: false,
  },
  scheduleMondayMornings: {
    description: 'Schedule to run Mondays before 5am',
    schedule: 'On mondays before 5am',
  },
  includeNodeModules: {
    description:
      'Include <code>package.json</code> files found within <code>node_modules</code> folders',
    ignoreNodeModules: false,
  },
  pinVersions: {
    description:
      'Use version pinning (maintain a single version only and not semver ranges)',
    pinVersions: true,
  },
  preserveSemverRanges: {
    description:
      'Preserve (but continue to upgrade) any existing semver ranges',
    pinVersions: false,
  },
  pinOnlyDevDependencies: {
    description:
      'Pin dependency versions for <code>devDependencies</code> and retain semver ranges for others',
    dependencies: { extends: ':preserveSemverRanges' },
    devDependencies: { extends: ':pinVersions' },
    optionalDependencies: { extends: ':preserveSemverRanges' },
    peerDependencies: { extends: ':preserveSemverRanges' },
  },
  separateMajorReleases: {
    description:
      'Separate major versions of dependencies into individual branches/PRs',
    separateMajorReleases: true,
  },
  separatePatchReleases: {
    description:
      'Separate patch and minor releases of dependencies into separate PRs',
    separatePatchReleases: true,
  },
  combinePatchMinorReleases: {
    description:
      'Use the same branch/PR for both patch and minor upgrades of a dependency',
    separatePatchReleases: false,
  },
  renovatePrefix: {
    description: 'Use <code>renovate/</code> as prefix for all branch names',
    branchprefix: 'renovate/',
  },
  semanticPrefixChore: {
    description:
      'Use <code>chore(deps):</code> as semantic prefix for commit messages and PR titles',
    semanticPrefix: 'chore(deps):',
  },
  semanticPrefixFix: {
    description:
      'Use <code>fix(deps):</code> as semantic prefix for commit messages and PR titles',
    semanticPrefix: 'fix(deps):',
  },
  disablePeerDependencies: {
    description:
      'Do not renovate <code>peerDependencies</code> versions/ranges',
    peerDependencies: { enabled: false },
  },
  semanticPrefixFixDepsChoreOthers: {
    description:
      'If semantic commits detected, use <code>fix(deps):</code> for dependencies and <code>chore(deps):</code> for all others',
    dependencies: { extends: ':semanticPrefixFix' },
    devDependencies: { extends: ':semanticPrefixChore' },
    optionalDependencies: { extends: ':semanticPrefixChore' },
    peerDependencies: { extends: ':semanticPrefixChore' },
  },
  unpublishSafe: {
    description:
      'Set a status check to warn when upgrades <  24 hours old might get unpublished',
    unpublishSafe: true,
  },
  unpublishSafeDisabled: {
    description:
      "Create branches/PRs for dependency upgrades as soon as they're available",
    unpublishSafe: false,
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
  automergeDisabled: {
    description: 'Do not automerge any upgrades - wait for humans to merge PRs',
    automerge: 'none',
  },
  automergePatch: {
    description: 'Automerge patch upgrades if they pass tests',
    automerge: 'patch',
  },
  automergeMinor: {
    description: 'Automerge patch or minor upgrades if they pass tests',
    automerge: 'minor',
  },
  automergeMajor: {
    description: 'Automerge all upgrades (inluding major) if they pass tests',
    automerge: 'any',
  },
  automergeBranchMergeCommit: {
    description: 'If automerging, perform a merge-commit on branch (no PR)',
    automergeType: 'branch-merge-commit',
  },
  automergeBranchPush: {
    description:
      'If automerging, push the new commit directly to base branch (no PR)',
    automergeType: 'branch-push',
  },
  automergePr: {
    description: 'Raise a PR first before any automerging',
    automergeType: 'pr',
  },
  automergeRequireAllStatusChecks: {
    description: 'Require all status checks to pass before any automerging',
    requiredStatusChecks: [],
  },
  maintainLockFilesDisabled: {
    description:
      'Update existing lock files only when <code>package.json</code> is modified',
    lockFileMaintenance: {
      enabled: false,
    },
  },
  maintainLockFilesWeekly: {
    description: 'Run lock file maintenance (updates) early Monday mornings',
    lockFileMaintenance: {
      enabled: true,
      extends: ':scheduleMondayMornings',
    },
  },
  ignoreUnstable: {
    description: 'Only upgrade to stable npm versions',
    ignoreUnstable: true,
  },
  respectLatest: {
    description:
      'Do not upgrade versions past the "latest" tag in npm registry',
    respectLatest: true,
  },
  automergeLinters: {
    description: 'Update lint packages automatically if tests pass',
    packageRules: [
      {
        extends: ['packages:linters'],
        automerge: 'any',
      },
    ],
  },
  doNotPinPackage: {
    description: 'Disable version pinning for <code>{{arg0}}</code>',
    packageRules: [
      {
        packageNames: ['{{arg0}}'],
        pinVersions: false,
      },
    ],
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
  base: {
    description: 'Default base configuration for repositories',
    extends: [
      ':separateMajorReleases',
      ':combinePatchMinorReleases',
      ':ignoreUnstable',
      ':respectLatest',
      ':unpublishSafeDisabled',
      ':prNotPending',
      ':renovatePrefix',
      ':semanticPrefixFixDepsChoreOthers',
      ':automergeDisabled',
      ':maintainLockFilesDisabled',
    ],
  },
  app: {
    description: 'Default configuration for webapps',
    extends: [':pinVersions', ':base'],
  },
  library: {
    description: 'Default configuration for libraries',
    extends: [':pinOnlyDevDependencies', ':base'],
  },
};
