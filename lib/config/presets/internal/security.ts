import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  'openssf-scorecard': {
    description: 'Show OpenSSF badge on pull requests',
    packageRules: [
      {
        matchSourceUrlPrefixes: ['https://github.com/'],
        prBodyDefinitions: {
          OpenSSF:
            '[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/{{sourceRepo}}/badge)](https://securityscorecards.dev/viewer/?uri=github.com/{{sourceRepo}})',
        },
        prBodyColumns: [
          'Package',
          'Type',
          'Update',
          'Change',
          'Pending',
          'OpenSSF',
        ],
      },
    ],
  },
};
