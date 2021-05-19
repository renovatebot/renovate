import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  base: {
    description: 'Default base configuration for all languages',
    extends: [
      ':separateMajorReleases',
      ':combinePatchMinorReleases',
      ':ignoreUnstable',
      ':prImmediately',
      ':semanticPrefixFixDepsChoreOthers',
      ':updateNotScheduled',
      ':automergeDisabled',
      ':ignoreModulesAndTests',
      ':autodetectPinVersions',
      ':prHourlyLimit2',
      ':prConcurrentLimit20',
      'group:monorepos',
      'group:recommended',
      'helpers:disableTypesNodeMajor',
      'workarounds:all',
    ],
  },
  'js-app': {
    description: 'Default configuration for webapps',
    extends: ['config:base', ':pinAllExceptPeerDependencies'],
  },
  'js-lib': {
    description: 'Default configuration for libraries',
    extends: ['config:base', ':pinOnlyDevDependencies'],
  },
  semverAllMonthly: {
    description:
      'Preserve semver ranges and update everything together once a month',
    separateMajorMinor: false,
    extends: [
      ':preserveSemverRanges',
      'group:all',
      'schedule:monthly',
      ':maintainLockFilesMonthly',
    ],
    lockFileMaintenance: {
      extends: ['group:all'],
      commitMessageAction: 'Update',
    },
  },
};
