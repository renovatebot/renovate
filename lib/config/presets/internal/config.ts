import { _ } from '../../../i18n';
import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  base: {
    description: _('Default base configuration for all languages.'),
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
  'js-app': {
    description: _('Default configuration for webapps.'),
    extends: ['config:base', ':pinAllExceptPeerDependencies'],
  },
  'js-lib': {
    description: _('Default configuration for libraries.'),
    extends: ['config:base', ':pinOnlyDevDependencies'],
  },
  semverAllMonthly: {
    description: _(
      'Preserve SemVer ranges and update everything together once a month.'
    ),
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
