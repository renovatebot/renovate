import { gt } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  dockerCompose: {
    description: gt.gettext('Enable Docker Compose image updating.'),
    'docker-compose': {
      enabled: true,
    },
  },
  dockerVersions: {
    description: gt.gettext('Upgrade Docker tags to newer versions.'),
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
    description: gt.gettext('Enable Buildkite functionality.'),
    buildkite: {
      enabled: true,
    },
  },
};
