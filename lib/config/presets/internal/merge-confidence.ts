import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  'all-badges': {
    description: 'Enable all Merge Confidence badges for pull requests.',
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
  minimal: {
    description: 'Enable Age & Confidence badges for pull requests.',
    packageRules: [
      {
        matchDatasources: ['maven', 'npm', 'pypi'],
        matchUpdateTypes: ['patch', 'minor', 'major'],
        prBodyColumns: ['Package', 'Change', 'Age', 'Confidence'],
      },
    ],
  },
};
