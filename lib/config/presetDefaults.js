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
    description: [
      'Include package.json files found within node_modules folders',
    ],
    ignoreNodeModules: false,
  },
  pinVersions: {
    description: [
      'Use version pinning (maintain a single version only and not semver ranges)',
    ],
    pinVersions: true,
  },
  preserveSemverRanges: {
    description: [
      'Preserve (but continue to upgrade) any existing semver ranges',
    ],
    pinVersions: false,
  },
  pinOnlyDevDependencies: {
    description: [
      'Pin dependency versions for devDependencies and preserve ranges for others',
    ],
    dependencies: { extends: ['preserveSemverRanges'] },
    devDependencies: { extends: ['pinVersions'] },
    optionalDependencies: { extends: ['preserveSemverRanges'] },
    peerDependencies: { extends: ['preserveSemverRanges'] },
  },
  separateMajorReleases: {
    description: [
      'Separate different major releases of a dependencies into separate PRs',
    ],
    separateMajorReleases: true,
  },
  separatePatchReleases: {
    description: [
      'Separate patch and minor releases of dependencies into separate PRs',
    ],
    separatePatchReleases: true,
  },
  combinePatchMinorReleases: {
    description: [
      'Combine any patch and minor upgrades of a dependency into the same PR',
    ],
    separatePatchReleases: false,
  },
  renovatePrefix: {
    description: 'Use "renovate/" as prefix for all branch names',
    branchprefix: 'renovate/',
  },
  semanticPrefixChore: {
    description: [
      'Use "chore(deps):" as semantic prefix for commit messages and PR titles',
    ],
    semanticPrefix: 'chore(deps):',
  },
  semanticPrefixFix: {
    description: [
      'Use "fix(deps):" as semantic prefix for commit messages and PR titles',
    ],
    semanticPrefix: 'fix(deps):',
  },
  disablePeerDependencies: {
    description: 'Do not renovate peerDependencies versions/ranges',
    peerDependencies: { enabled: false },
  },
  semanticPrefixFixDepsChoreOthers: {
    description: [
      'If semantic commits detected, use "fix(deps):" for dependencies and "chore(deps):" for all others',
    ],
    dependencies: { extends: ['semanticPrefixFix'] },
    devDependencies: { extends: ['semanticPrefixChore'] },
    optionalDependencies: { extends: ['semanticPrefixChore'] },
    peerDependencies: { extends: ['semanticPrefixChore'] },
  },
  unpublishSafe: {
    description: [
      'Set a status check to warn when upgrades <  24 hours old might get unpublished',
    ],
    unpublishSafe: true,
  },
  unpublishSafeDisabled: {
    description: [
      'Do not add "pending" status check for packages < 24 hours old',
    ],
    unpublishSafe: false,
  },
  prImmediately: {
    description: 'Raise PRs immediately (after branch is created)',
    prCreation: 'immediate',
  },
  prNotPending: {
    description: [
      'Raise PRs only once branch status is no longer in "pending" state',
    ],
    prCreation: 'not-pending',
  },
  automergeDisabled: {
    description: 'Do not automerge any upgrades',
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
    description: [
      'If automerging, push the new commit directly to base branch (no PR)',
    ],
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
    description: [
      'If preset, update lock files only when package.json is modified',
    ],
    lockFileMaintenance: {
      enabled: false,
    },
  },
  maintainLockFilesWeekly: {
    description: 'Run lock file maintenance (updates) early Monday mornings',
    lockFileMaintenance: {
      enabled: true,
      extends: ['scheduleMondayMornings'],
    },
  },
  ignoreUnstable: {
    description: 'Only upgrade to stable npm versions',
    ignoreUnstable: true,
  },
  respectLatest: {
    description: [
      'Do not upgrade versions past the "latest" tag in npm registry',
    ],
    respectLatest: true,
  },
  automergeLinters: {
    description: 'Update lint packages automatically if tests pass',
    extends: ['allLinters'],
    automerge: 'any',
  },
  base: {
    description: 'Default base configuration for repositories',
    extends: [
      'separateMajorReleases',
      'combinePatchMinorReleases',
      'ignoreUnstable',
      'respectLatest',
      'unpublishSafe',
      'prNotPending',
      'renovatePrefix',
      'semanticPrefixFixDepsChoreOthers',
      'automergeDisabled',
      'maintainLockFilesDisabled',
    ],
  },
  app: {
    description: 'Default configuration for webapps',
    extends: ['base', 'pinVersions'],
  },
  library: {
    description: 'Default configuration for libraries',
    extends: ['pinOnlyDevDependencies', 'base'],
  },
};
