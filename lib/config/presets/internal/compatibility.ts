import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  additionalBranchPrefix: {
    buildkite: {
      additionalBranchPrefix: 'buildkite-',
    },
    cargo: {
      additionalBranchPrefix: 'rust-',
    },
    description:
      'Backwards-compatibility preset to restore `additionalBranchPrefix` settings for multiple managers which were removed in Renovate `v25`.',
    homebrew: {
      additionalBranchPrefix: 'homebrew-',
    },
    packageRules: [
      {
        additionalBranchPrefix: 'helm-',
        matchDatasources: ['helm'],
      },
      {
        additionalBranchPrefix: 'docker-',
        matchManagers: ['dockerfile', 'docker-compose'],
      },
    ],
  },
};
