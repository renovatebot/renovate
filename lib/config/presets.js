const configParser = require('./index');

module.exports = {
  resolvePresets,
};

function resolvePresets(inputConfig) {
  const { logger } = inputConfig;
  logger.debug('Resolving presets');
  let config = { ...inputConfig };
  if (!config.presets) {
    logger.debug('No presets');
    return inputConfig;
  }
  for (const preset of config.presets) {
    logger.debug(`Resolving preset "${preset}"`);
    config = configParser.mergeChildConfig(
      config,
      resolvePreset(preset, config.logger)
    );
  }
  delete config.presets;
  return config;
}

function resolvePreset(preset, logger, existing = []) {
  logger.trace(`resolvePreset(${preset}, existing=${existing})`);
  if (existing.indexOf(preset) !== -1) {
    logger.warn(`Already seen preset ${preset}`);
    return {};
  }
  existing.push(preset);
  let presetConfig = presets[preset];
  if (!presetConfig) {
    logger.warn(`Cannot find preset ${preset}`);
    return {};
  }
  logger.debug(`Preset "${preset}" config is ${JSON.stringify(presetConfig)}`);
  const subPresets = presetConfig.presets;
  if (!subPresets) {
    logger.debug(`No subPresets found inside ${preset}`);
    return presetConfig;
  }
  delete presetConfig.presets;
  if (Object.keys(presetConfig).length === 1) {
    logger.debug('Deleting description from nested preset');
    presetConfig.description = [];
  }
  for (const subPreset of subPresets) {
    presetConfig = configParser.mergeChildConfig(
      presetConfig,
      resolvePreset(subPreset, logger, existing)
    );
  }
  logger.debug(`Returning ${JSON.stringify(presetConfig)} for ${preset}`);
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
      'Set a status check to warn when upgrades < 24 hours old can be unpublished',
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
    description: ['Automerge all upgrades (inluding major) it they pass tests'],
    automerge: 'minor',
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
    description: ['Update lock files only when package.json is modified'],
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
  base: {
    description: ['Default base configuration for repositories'],
    presets: [
      'separateMajorReleases',
      'combinePatchMinorReleases',
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
