import { _ } from '../../../i18n';
import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  disable: {
    circleci: {
      enabled: false,
    },
    description: _('Disable Docker updates.'),
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
    description: _('Enable Docker `major` updates.'),
    packageRules: [
      {
        enabled: true,
        matchDatasources: ['docker'],
        matchUpdateTypes: ['major'],
      },
    ],
  },
  pinDigests: {
    description: _('Pin Docker digests.'),
    docker: {
      pinDigests: true,
    },
  },
};
