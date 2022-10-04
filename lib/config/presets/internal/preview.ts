import { _ } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  dockerCompose: {
    description: _('Enable Docker Compose image updating.'),
    'docker-compose': {
      enabled: true,
    },
  },
  dockerVersions: {
    description: _('Upgrade Docker tags to newer versions.'),
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
    description: _('Enable Buildkite functionality.'),
    buildkite: {
      enabled: true,
    },
  },
};
