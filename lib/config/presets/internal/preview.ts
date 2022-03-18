import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  dockerCompose: {
    description: 'Enable Docker Compose image updating',
    'docker-compose': {
      enabled: true,
    },
  },
  dockerVersions: {
    description: 'Upgrade Docker tags to newer versions',
    docker: {
      major: {
        enabled: true,
      },
      minor: {
        enabled: true,
      },
    },
  },
  buildkite: {
    description: 'Enable Buildkite functionality',
    buildkite: {
      enabled: true,
    },
  },
};
