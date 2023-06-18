import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  disable: {
    circleci: {
      enabled: false,
    },
    description: 'Disable Docker updates.',
    docker: {
      enabled: false,
    },
    'docker-compose': {
      enabled: false,
    },
  },
  disableMajor: {
    description: 'Disable Docker `major` updates.',
    packageRules: [
      {
        enabled: false,
        matchDatasources: ['docker'],
        matchUpdateTypes: ['major'],
      },
    ],
  },
  enableMajor: {
    description: 'Enable Docker `major` updates.',
    packageRules: [
      {
        enabled: true,
        matchDatasources: ['docker'],
        matchUpdateTypes: ['major'],
      },
    ],
  },
  pinDigests: {
    description: 'Pin Docker digests.',
    docker: {
      pinDigests: true,
    },
  },
};
