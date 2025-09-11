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
  'minimum-release-age': {
    description:
      'Provide defaults to reduce the risk of Renovate updating to a compromised/malicious package by using `minimumReleaseAge` with a set of defaults for package managers that support `minimumReleaseAge`.',
    extends: ['security:minimum-release-age-npm'],
  },
  'minimum-release-age-npm': {
    description:
      'Provide defaults to reduce the risk of Renovate updating to a compromised/malicious package by providing a default `minimumReleaseAge` for npm package updates.',
    extends: ['npm:unpublishSafe'],
  },
};
