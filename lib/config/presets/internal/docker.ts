import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  disable: {
    description: 'Disable Docker updates',
    docker: {
      enabled: false,
    },
    'docker-compose': {
      enabled: false,
    },
    circleci: {
      enabled: false,
    },
  },
  enableMajor: {
    description: 'Enable Docker major updates',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchUpdateTypes: ['major'],
        enabled: true,
      },
    ],
  },
  disableMajor: {
    description: 'Disable Docker major updates',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchUpdateTypes: ['major'],
        enabled: false,
      },
    ],
  },
  pinDigests: {
    description: 'Pin Docker digests',
    docker: {
      pinDigests: true,
    },
  },
};
