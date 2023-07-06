import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  default: {
    description: 'Enable Merge Confidence badges for pull requests.',
    packageRules: [
      {
        matchDatasources: ['maven', 'npm', 'pypi'],
        matchUpdateTypes: ['patch', 'minor', 'major'],
        prBodyColumns: [
          'Package',
          'Change',
          'Age',
          'Adoption',
          'Passing',
          'Confidence',
        ],
      },
    ],
  },
};
