import type { Preset } from '../types.ts';

export const supportedDatasources = [
  'go',
  'maven',
  'npm',
  'nuget',
  'packagist',
  'pypi',
  'rubygems',
];

export const presets: Record<string, Preset> = {
  'age-confidence-badges': {
    description:
      'Show only the Age and Confidence Merge Confidence badges for pull requests.',
    packageRules: [
      {
        matchDatasources: supportedDatasources,
        matchUpdateTypes: ['patch', 'minor', 'major'],
        prBodyColumns: ['Package', 'Change', 'Age', 'Confidence'],
      },
    ],
  },
  'all-badges': {
    description: 'Show all Merge Confidence badges for pull requests.',
    packageRules: [
      {
        matchDatasources: supportedDatasources,
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
