import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  'openssf-scorecard': {
    description: 'Show OpenSSF badge on pull requests.',
    packageRules: [
      {
        matchSourceUrlPrefixes: ['https://github.com/', 'https://gitlab.com'],
        prBodyDefinitions: {
          OpenSSF:
            "[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/{{{ replace '(^https?://)?' '' sourceUrl }}}/badge)](https://securityscorecards.dev/viewer/?uri={{{ replace '(^https?://)?' '' sourceUrl }}})",
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
