import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  base: {
    description: 'Default base configuration for all languages.',
    extends: [
      ':dependencyDashboard',
      ':semanticPrefixFixDepsChoreOthers',
      ':ignoreModulesAndTests',
      'group:monorepos',
      'group:recommended',
      'replacements:all',
      'workarounds:all',
    ],
  },
  'best-practice': {
    description: 'Preset with what renovate considers best practice.',
    extends: [
      'config:base',
      'docker:pinDigests',
      'helpers:pinGitHubActionDigests',
    ],
    packageRules: [
      {
        matchDepTypes: ['devDependencies'],
        rangeStrategy: 'pin',
      },
    ],
  },
  'js-app': {
    description: 'Default configuration for webapps.',
    extends: ['config:base', ':pinAllExceptPeerDependencies'],
  },
  'js-lib': {
    description: 'Default configuration for libraries.',
    extends: ['config:base', ':pinOnlyDevDependencies'],
  },
  semverAllMonthly: {
    description:
      'Preserve SemVer ranges and update everything together once a month.',
    extends: [
      ':preserveSemverRanges',
      'group:all',
      'schedule:monthly',
      ':maintainLockFilesMonthly',
    ],
    lockFileMaintenance: {
      commitMessageAction: 'Update',
      extends: ['group:all'],
    },
    separateMajorMinor: false,
  },
};
