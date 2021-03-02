import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  disable: {
    description: 'Disable docker updates',
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
    description: 'Enable docker major updates',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchUpdateTypes: ['major'],
        enabled: true,
      },
    ],
  },
  disableMajor: {
    description: 'Disable docker major updates',
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
