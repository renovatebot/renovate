import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  core: {
    description: 'Group Drupal core updates together.',
    packageRules: [
      {
        groupName: 'Drupal Core',
        labels: ['drupal core'],
        matchPackageNames: ['drupal/core', '/^drupal/core-.*/'],
      },
    ],
  },
};
