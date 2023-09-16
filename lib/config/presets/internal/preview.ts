import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  buildkite: {
    buildkite: {
      enabled: true,
    },
    description: 'Enable Buildkite functionality.',
  },
  dockerCompose: {
    description: 'Enable Docker Compose image updating.',
    'docker-compose': {
      enabled: true,
    },
  },
  dockerVersions: {
    description: 'Upgrade Docker tags to newer versions.',
    'docker-compose': {
      major: {
        enabled: true,
      },
      minor: {
        enabled: true,
      },
    },
    dockerfile: {
      major: {
        enabled: true,
      },
      minor: {
        enabled: true,
      },
    },
  },
};
