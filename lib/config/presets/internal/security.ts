import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  'openssf-scorecard': {
    description: 'Show OpenSSF badge on pull requests.',
    packageRules: [
      {
        matchSourceUrls: ['https://github.com/**'],
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
  'only-security-updates': {
    description:
      'Only update dependencies if vulnerabilities have been detected.',
    extends: ['config:recommended'],
    packageRules: [
      {
        enabled: false,
        matchPackageNames: ['*'],
      },
    ],
    vulnerabilityAlerts: {
      enabled: true,
    },
    osvVulnerabilityAlerts: true,
  },
  minimumReleaseAgeNpm: {
    description:
      'Wait until the npm package is three days old before raising the update. This a) introduces a short delay to allow for malware researchers and scanners to (possibly) detect any malicious behaviour in packages, and b) prevents the maintainer and/or NPM from unpublishing a package you already upgraded to, breaking builds.',
    npm: {
      minimumReleaseAge: '3 days',
      internalChecksFilter: 'strict',
      prCreation: 'not-pending',
    },
  },
};
