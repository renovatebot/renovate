const configParser = require('./index');

module.exports = {
  resolvePresets,
};

function resolvePresets(
  inputConfig,
  logger = inputConfig.logger,
  existing = []
) {
  logger.trace({ config: inputConfig, existing }, 'resolvePresets');
  // First, merge all the preset configs
  let config = {};
  if (inputConfig.presets) {
    for (const preset of inputConfig.presets) {
      // istanbul ignore if
      if (existing.indexOf(preset) !== -1) {
        logger.warn(`Already seen preset ${preset} in ${existing}`);
      } else {
        logger.debug(`Resolving preset "${preset}"`);
        config = configParser.mergeChildConfig(
          config,
          resolvePresets(
            getPreset(preset, logger),
            logger,
            existing.concat([preset])
          )
        );
      }
    }
  }
  // Now assign "regular" config on top
  config = configParser.mergeChildConfig(config, inputConfig);
  delete config.presets;
  for (const key of Object.keys(config)) {
    if (isObject(config[key])) {
      logger.debug(`Resolving object "${key}"`);
      config[key] = resolvePresets(config[key], logger, existing);
    }
  }
  return config;
}

function getPreset(preset, logger) {
  const presetConfig = presets[preset];
  if (!presetConfig) {
    logger.warn(`Cannot find preset ${preset}`);
    return {};
  }
  return presetConfig;
}

const presets = {
  enableRenovate: {
    description: ['Enable renovate'],
    enabled: true,
  },
  disableRenovate: {
    description: ['Disable renovate'],
    enabled: false,
  },
  scheduleMondayMornings: {
    description: ['Schedule to run Mondays before 5am'],
    schedule: ['On mondays before 5am'],
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
    dependencies: { presets: ['preserveSemverRanges'] },
    devDependencies: { presets: ['pinVersions'] },
    optionalDependencies: { presets: ['preserveSemverRanges'] },
    peerDependencies: { presets: ['preserveSemverRanges'] },
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
    description: ['Use "renovate/" as prefix for all branch names'],
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
    description: ['Do not renovate peerDependencies versions/ranges'],
    peerDependencies: { enabled: false },
  },
  semanticPrefixFixDepsChoreOthers: {
    description: [
      'If semantic commits detected, use "fix(deps):" for dependencies and "chore(deps):" for all others',
    ],
    dependencies: { presets: ['semanticPrefixFix'] },
    devDependencies: { presets: ['semanticPrefixChore'] },
    optionalDependencies: { presets: ['semanticPrefixChore'] },
    peerDependencies: { presets: ['semanticPrefixChore'] },
  },
  unpublishSafe: {
    description: [
      'Set a status check to warn when upgrades <  24 hours old might get unpublished',
    ],
    unpublishSafe: true,
  },
  prImmediately: {
    description: ['Raise PRs immediately (after branch is created)'],
    prCreation: 'immediate',
  },
  prNotPending: {
    description: [
      'Raise PRs only once branch status is no longer in "pending" state',
    ],
    prCreation: 'not-pending',
  },
  automergeDisabled: {
    description: ['Do not automerge any upgrades'],
    automerge: 'none',
  },
  automergePatch: {
    description: ['Automerge patch upgrades if they pass tests'],
    automerge: 'patch',
  },
  automergeMinor: {
    description: ['Automerge patch or minor upgrades if they pass tests'],
    automerge: 'minor',
  },
  automergeMajor: {
    description: ['Automerge all upgrades (inluding major) if they pass tests'],
    automerge: 'any',
  },
  automergeBranchMergeCommit: {
    description: ['If automerging, perform a merge-commit on branch (no PR)'],
    automergeType: 'branch-merge-commit',
  },
  automergeBranchPush: {
    description: [
      'If automerging, push the new commit directly to base branch (no PR)',
    ],
    automergeType: 'branch-push',
  },
  automergePr: {
    description: ['Raise a PR first before any automerging'],
    automergeType: 'pr',
  },
  automergeRequireAllStatusChecks: {
    description: ['Require all status checks to pass before any automerging'],
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
    description: ['Run lock file maintenance (updates) early Monday mornings'],
    lockFileMaintenance: {
      enabled: true,
      presets: ['scheduleMondayMornings'],
    },
  },
  ignoreUnstable: {
    description: ['Only upgrade to stable npm versions'],
    ignoreUnstable: true,
  },
  respectLatest: {
    description: [
      'Do not upgrade versions past the "latest" tag in npm registry',
    ],
    respectLatest: true,
  },
  base: {
    description: ['Default base configuration for repositories'],
    presets: [
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
    description: ['Default configuration for webapps'],
    presets: ['base', 'pinVersions'],
  },
  library: {
    description: ['Default configuration for libraries'],
    presets: ['pinOnlyDevDependencies', 'base'],
  },
};

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
