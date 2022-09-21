import { gt } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  disable: {
    description: gt.gettext('Disable Docker updates.'),
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
    description: gt.gettext('Enable Docker `major` updates.'),
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchUpdateTypes: ['major'],
        enabled: true,
      },
    ],
  },
  disableMajor: {
    description: gt.gettext('Disable Docker `major` updates.'),
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchUpdateTypes: ['major'],
        enabled: false,
      },
    ],
  },
  pinDigests: {
    description: gt.gettext('Pin Docker digests.'),
    docker: {
      pinDigests: true,
    },
  },
};
