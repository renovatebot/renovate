import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  'all-badges': {
    description: 'Show all Merge Confidence badges for pull requests.',
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
  'age-confidence-badges': {
    description:
      'Show only the Age and Confidence Merge Confidence badges for pull requests.',
    packageRules: [
      {
        matchDatasources: ['maven', 'npm', 'pypi'],
        matchUpdateTypes: ['patch', 'minor', 'major'],
        prBodyColumns: ['Package', 'Change', 'Age', 'Confidence'],
      },
    ],
  },
};
