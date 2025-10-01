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
      'Wait until the npm package is three days old before raising the update, this prevents npm unpublishing a package you already upgraded to.',
    npm: {
      minimumReleaseAge: '3 days',
    },
  },
  minimumReleaseAge: {
    description:
      'Provide defaults to reduce the risk of Renovate updating to a compromised/malicious package by using `minimumReleaseAge` with a set of defaults for package managers that support `minimumReleaseAge`. At this time, this only affects npm.',
    extends: ['security:minimumReleaseAgeNpm'],
  },
};
