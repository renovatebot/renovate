import { _ } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  disable: {
    description: _('Disable Docker updates.'),
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
    description: _('Enable Docker `major` updates.'),
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchUpdateTypes: ['major'],
        enabled: true,
      },
    ],
  },
  disableMajor: {
    description: _('Disable Docker `major` updates.'),
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchUpdateTypes: ['major'],
        enabled: false,
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
