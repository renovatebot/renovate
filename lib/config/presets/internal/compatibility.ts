import { Preset } from '../types';

export const presets: Record<string, Preset> = {
  additionalBranchPrefix: {
    description:
      'Restore old Renovate behavior prior to v25 ask @rarkins for better description, see PR #9373',
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
