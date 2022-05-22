import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  additionalBranchPrefix: {
    description:
      'Backwards-compatibility preset to restore additionalBranchPrefix settings for multiple managers which were removed in v25',
    buildkite: {
      additionalBranchPrefix: 'buildkite-',
    },
    cargo: {
      additionalBranchPrefix: 'rust-',
    },
    docker: {
      additionalBranchPrefix: 'docker-',
    },
    homebrew: {
      additionalBranchPrefix: 'homebrew-',
    },
    packageRules: [
      {
        matchDatasources: ['helm'],
        additionalBranchPrefix: 'helm-',
      },
    ],
  },
};
