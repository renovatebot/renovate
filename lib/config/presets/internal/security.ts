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
    packageRules: [
      {
        matchDatasources: ['npm'],
        minimumReleaseAge: '3 days',
        internalChecksFilter: 'strict',
      },
      {
        description:
          'Do not require Minimum Release Age for update types that are controlled by the package manager',
        matchDatasources: ['npm'],
        matchUpdateTypes: ['lockFileMaintenance'],
        prBodyNotes: [
          "⚠️ Renovate's lock file maintenance functionality does not support validating Minimum Release Age, as the package manager performs the required changes to update package(s). Confirm whether your package manager perform its own validation for the Minimum Release Age of packages.",
        ],
        minimumReleaseAge: null,
      },
      {
        description:
          'Do not require Minimum Release Age for package replacements',
        matchDatasources: ['npm'],
        matchUpdateTypes: ['replacement'],
        prBodyNotes: [
          "⚠️ Renovate's replacement functionality [does not currently](https://github.com/renovatebot/renovate/issues/39400) wire in the release age for a package, so the Minimum Release Age checks can apply. You will need to manually validate the Minimum Release Age for these package(s).",
        ],
        minimumReleaseAge: null,
      },
    ],
  },
};
