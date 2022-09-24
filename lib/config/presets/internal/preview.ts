import { gettext } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  dockerCompose: {
    description: gettext('Enable Docker Compose image updating.'),
    'docker-compose': {
      enabled: true,
    },
  },
  dockerVersions: {
    description: gettext('Upgrade Docker tags to newer versions.'),
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
    description: gettext('Enable Buildkite functionality.'),
    buildkite: {
      enabled: true,
    },
  },
};
