import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  dockerCompose: {
    description: 'Enable docker compose image updating',
    'docker-compose': {
      enabled: true,
    },
  },
  dockerVersions: {
    description: 'Upgrade docker tags to newer versions',
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
    description: 'Enable buildkite functionality',
    buildkite: {
      enabled: true,
    },
  },
};
