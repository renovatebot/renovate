import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { PackageRule } from '../../types.ts';
import { UpdateTypesOptions } from '../../types.ts';
import type { Preset } from '../types.ts';

interface MinimumReleaseAgeDatasource {
  description: string;
  minimumReleaseAge: string;
}

/**
 * Datasources for which we expose a `security:minimumReleaseAge*` preset.
 *
 * Only supported for Datasources that have `releaseTimestampSupport`.
 */
const minimumReleaseAgeDatasources: Partial<
  Record<DatasourceName, MinimumReleaseAgeDatasource>
> = {
  crate: {
    description:
      "Wait until the Crate version is three days old before raising the update. This a) introduces a short delay to allow for malware researchers and scanners to (possibly) detect any malicious behaviour in crates, and b) reduces the risk of upgrading to a newly published crate that its owner deletes during crates.io's initial 72-hour deletion window.",
    minimumReleaseAge: '3 days',
  },
  npm: {
    description:
      'Wait until the npm package is three days old before raising the update. This a) introduces a short delay to allow for malware researchers and scanners to (possibly) detect any malicious behaviour in packages, and b) prevents the maintainer and/or NPM from unpublishing a package you already upgraded to, breaking builds.',
    minimumReleaseAge: '3 days',
  },
};

/**
 * Certain update types don't currently support `releaseTimestamp`s, so applying `minimumReleaseAge` to them results in updates that will never come.
 *
 * Instead, we opt them out of `minimumReleaseAge`, and add a warning for the user.
 *
 * These rules are datasource-agnostic (`matchDatasources` is added per preset), so they are shared across every generated `security:minimumReleaseAge*` preset to keep the warnings consistent.
 */
const unsupportedUpdateTypeRules: PackageRule[] = [
  {
    description:
      'Do not require Minimum Release Age for update types that are controlled by the package manager',
    matchUpdateTypes: ['lockFileMaintenance'],
    minimumReleaseAge: null,
    prBodyNotes: [
      "⚠️ Renovate's lock file maintenance functionality does not support validating Minimum Release Age, as the package manager performs the required changes to update package(s). Confirm whether your package manager perform its own validation for the Minimum Release Age of packages.",
    ],
  },
  // TODO #39400
  {
    description: 'Do not require Minimum Release Age for package replacements',
    matchUpdateTypes: ['replacement'],
    minimumReleaseAge: null,
    prBodyNotes: [
      "⚠️ Renovate's replacement functionality [does not currently](https://github.com/renovatebot/renovate/issues/39400) wire in the release age for a package, so the Minimum Release Age checks can apply. You will need to manually validate the Minimum Release Age for these package(s).",
    ],
  },
  // TODO #40288
  {
    description: 'Do not require Minimum Release Age for package pinning',
    matchUpdateTypes: ['pin'],
    minimumReleaseAge: null,
    prBodyNotes: [
      "⚠️ Renovate's pin functionality [does not currently](https://github.com/renovatebot/renovate/issues/40288) wire in the release age for a package, so the Minimum Release Age checks can apply. You will need to manually validate the Minimum Release Age for these package(s).",
    ],
  },
];

function buildMinimumReleaseAgePreset(
  datasource: string,
  { description, minimumReleaseAge }: MinimumReleaseAgeDatasource,
): Preset {
  const packageRules: PackageRule[] = [
    {
      internalChecksFilter: 'strict',
      matchDatasources: [datasource],
      minimumReleaseAge,
    },
    ...unsupportedUpdateTypeRules.map(
      (rule): PackageRule => ({ ...rule, matchDatasources: [datasource] }),
    ),
  ];

  return { description, packageRules };
}

function loadMinimumReleaseAgePresets(): Record<string, Preset> {
  const presets: Record<string, Preset> = {};

  for (const [datasource, config] of Object.entries(
    minimumReleaseAgeDatasources,
  )) {
    const suffix = datasource[0].toUpperCase() + datasource.slice(1);
    presets[`minimumReleaseAge${suffix}`] = buildMinimumReleaseAgePreset(
      datasource,
      config,
    );
  }

  return presets;
}

export const presets: Record<string, Preset> = {
  gomodIndirectSecurityUpdates: {
    description:
      'Enable go.mod indirect dependency updates only when vulnerabilities have been detected.',
    extends: [':enableVulnerabilityAlerts'],
    packageRules: [
      {
        description: 'Enable lookups for indirect go.mod dependencies',
        enabled: true,
        matchDepTypes: ['indirect'],
        matchManagers: ['gomod'],
      },
      {
        description:
          'Disable non-security updates for indirect go.mod dependencies (vulnerability alerts use force to override this)',
        enabled: false,
        matchDepTypes: ['indirect'],
        matchManagers: ['gomod'],
        matchUpdateTypes: [...UpdateTypesOptions],
      },
    ],
  },
  ...loadMinimumReleaseAgePresets(),
  'only-security-updates': {
    description:
      'Only update dependencies if vulnerabilities have been detected.',
    extends: ['config:recommended'],
    osvVulnerabilityAlerts: true,
    packageRules: [
      {
        enabled: false,
        matchPackageNames: ['*'],
      },
    ],
    vulnerabilityAlerts: {
      enabled: true,
    },
  },
  'openssf-scorecard': {
    description: 'Show OpenSSF badge on pull requests.',
    packageRules: [
      {
        matchSourceUrls: ['https://github.com/**'],
        prBodyColumns: [
          'Package',
          'Type',
          'Update',
          'Change',
          'Pending',
          'OpenSSF',
        ],
        prBodyDefinitions: {
          OpenSSF:
            '[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/{{sourceRepo}}/badge)](https://securityscorecards.dev/viewer/?uri=github.com/{{sourceRepo}})',
        },
      },
    ],
  },
};

export const minimumReleaseAgeDatasourceNames = Object.keys(
  minimumReleaseAgeDatasources,
);
