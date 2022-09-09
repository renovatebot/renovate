import { _ } from '../../../i18n';
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
};
