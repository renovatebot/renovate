import { Preset } from '../types';

export const presets: Record<string, Preset> = {
  additionalBranchPrefix: {
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
