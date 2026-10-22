import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { FilterConfig } from '../../../workers/repository/process/lookup/types.ts';
import type { PackageRule, RenovateConfig } from '../../types.ts';
import { UpdateTypesOptions } from '../../types.ts';
import type { Preset } from '../types.ts';

// Renovate accepts these options in package rules, but PackageRule omits them.
// We extend the type only in this emergency preset. If other presets need these
// options, add them to the shared types.
const php2shellBranchConfig = {
  automerge: false,
  branchConcurrentLimit: 0,
  commitMessageAction: 'Patch',
  commitMessageTopic: 'PHP2Shell vulnerabilities',
  dependencyDashboardApproval: false,
  minimumGroupSize: 1,
  prConcurrentLimit: 0,
  prCreation: 'immediate',
  prHourlyLimit: 0,
  schedule: [],
} satisfies PackageRule &
  Pick<
    RenovateConfig,
    | 'branchConcurrentLimit'
    | 'minimumGroupSize'
    | 'prConcurrentLimit'
    | 'prHourlyLimit'
  >;

const php2shellRule = {
  ...php2shellBranchConfig,
  enabled: true,
  followTag: '',
  group: php2shellBranchConfig,
  groupName: 'PHP2Shell security fixes',
  groupSingleUpdates: true,
  ignoreUnstable: true,
  matchJsonata: ['$not(vulnerabilityAlerts.enabled = false)'],
  minimumReleaseAge: null,
  prBodyNotes: [
    [
      '> ⚠️ PHP2Shell vulnerabilities can allow remote code execution. This PR updates affected PHP versions to patched releases. Rebuild affected images, deploy the updates, and restart PHP workers.',
      '>',
      '> Details: [CVE-2026-109618](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) and [CVE-2026-109619](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp).',
    ].join('\n'),
  ],
  rangeStrategy: 'bump',
  separateMinorPatch: false,
  updatePinnedDependencies: true,
} satisfies PackageRule & Pick<FilterConfig, 'updatePinnedDependencies'>;

const php2shellGithubRule: PackageRule = {
  ...php2shellRule,
  matchDatasources: ['github-tags'],
  matchPackageNames: ['containerbase/php-prebuild', 'php/php-src'],
  rangeStrategy: 'update-lockfile',
  versioning: 'semver',
};

const php2shellDockerRule: PackageRule = {
  ...php2shellRule,
  matchDatasources: ['docker'],
  matchPackageNames: [
    '/^(?:(?:docker\\.io|index\\.docker\\.io)\\/)?(?:library\\/)?php$/',
  ],
};

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
  pypi: {
    description:
      'Wait until the Python package is three days old before raising the update. This introduces a short delay to allow for malware researchers and scanners to (possibly) detect any malicious behaviour in packages.',
    minimumReleaseAge: '3 days',
  },
};

/**
 * Certain update types don't currently support `releaseTimestamp`s, so applying `minimumReleaseAge` to them results in updates that will never come.
 *
 * Instead, we opt them out of `minimumReleaseAge`, and add a warning for the user.
 *
 * This must stay in sync with the update types documented as _not_ supported (❌) in `docs/usage/key-concepts/minimum-release-age.md`, so we opt-out any unsupported `updateType`s.
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
  {
    description:
      'Do not require Minimum Release Age for update types that do not provide a release timestamp',
    matchUpdateTypes: ['bump', 'lockfileUpdate', 'rollback'],
    minimumReleaseAge: null,
    prBodyNotes: [
      '⚠️ Renovate does not enforce Minimum Release Age for `bump`, `lockfileUpdate`, or `rollback` updates, so these are raised without a Minimum Release Age check. You will need to manually validate the Minimum Release Age for these package(s).',
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
    ...unsupportedUpdateTypeRules.map((rule): PackageRule => ({
      ...rule,
      matchDatasources: [datasource],
    })),
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
  php2shell: {
    customManagers: [
      {
        customType: 'regex',
        datasourceTemplate: 'github-tags',
        depNameTemplate: 'php',
        depTypeTemplate: 'php2shell-runtime',
        extractVersionTemplate: '^php-(?<version>\\S+)',
        managerFilePatterns: ['/(^|/)\\.php-version$/'],
        matchStrings: ['^\\s*(?<currentValue>8\\.[2-5]\\.\\d+)\\s*$'],
        packageNameTemplate: 'php/php-src',
      },
      {
        customType: 'jsonata',
        datasourceTemplate: 'github-tags',
        depNameTemplate: 'php',
        depTypeTemplate: 'php2shell-runtime',
        extractVersionTemplate: '^php-(?<version>\\S+)',
        fileFormat: 'yaml',
        managerFilePatterns: [
          '/(^|/)(workflow-templates|\\.(?:github|gitea|forgejo)/(?:workflows|actions))/.+\\.ya?ml$/',
          '/(^|/)action\\.ya?ml$/',
        ],
        matchStrings: [
          '**[uses and $exists($match(uses, /^shivammathur\\/setup-php@/))].with."php-version"[$type($) = "string" and $exists($match($, /^8\\.[2-5]\\.\\d+$/))].{"currentValue": $}',
        ],
        packageNameTemplate: 'php/php-src',
      },
    ],
    description:
      'Update vulnerable PHP runtime pins for CVE-2026-109618 and CVE-2026-109619.',
    packageRules: [
      {
        enabled: false,
        matchDepTypes: ['php2shell-runtime'],
        matchManagers: ['custom.regex', 'custom.jsonata'],
      },
      {
        ...php2shellGithubRule,
        allowedVersions: '>=8.2.35 <8.3.0',
        matchJsonata: [
          '$not(vulnerabilityAlerts.enabled = false) and $exists($match((manager = "mise" and isLockfileOnly) ? lockedVersion : currentValue, /^8\\.2\\.(?:[0-9]|[12][0-9]|3[0-4])$/))',
        ],
      },
      {
        ...php2shellGithubRule,
        allowedVersions: '>=8.3.36 <8.4.0',
        matchJsonata: [
          '$not(vulnerabilityAlerts.enabled = false) and $exists($match((manager = "mise" and isLockfileOnly) ? lockedVersion : currentValue, /^8\\.3\\.(?:[0-9]|[12][0-9]|3[0-5])$/))',
        ],
      },
      {
        ...php2shellGithubRule,
        allowedVersions: '>=8.4.27 <8.5.0',
        matchJsonata: [
          '$not(vulnerabilityAlerts.enabled = false) and $exists($match((manager = "mise" and isLockfileOnly) ? lockedVersion : currentValue, /^8\\.4\\.(?:[0-9]|1[0-9]|2[0-6])$/))',
        ],
      },
      {
        ...php2shellGithubRule,
        allowedVersions: '>=8.5.12 <8.6.0',
        matchJsonata: [
          '$not(vulnerabilityAlerts.enabled = false) and $exists($match((manager = "mise" and isLockfileOnly) ? lockedVersion : currentValue, /^8\\.5\\.(?:[0-9]|1[01])$/))',
        ],
      },
      ...[
        {
          ...php2shellDockerRule,
          allowedVersions:
            '/^8\\.2\\.(?:3[5-9]|[4-9][0-9]|[1-9][0-9]{2,})(?:-.+)?$/',
          matchCurrentValue: '/^8\\.2\\.(?:[0-9]|[12][0-9]|3[0-4])(?:-.+)?$/',
        },
        {
          ...php2shellDockerRule,
          allowedVersions:
            '/^8\\.3\\.(?:3[6-9]|[4-9][0-9]|[1-9][0-9]{2,})(?:-.+)?$/',
          matchCurrentValue: '/^8\\.3\\.(?:[0-9]|[12][0-9]|3[0-5])(?:-.+)?$/',
        },
        {
          ...php2shellDockerRule,
          allowedVersions:
            '/^8\\.4\\.(?:2[7-9]|[3-9][0-9]|[1-9][0-9]{2,})(?:-.+)?$/',
          matchCurrentValue: '/^8\\.4\\.(?:[0-9]|1[0-9]|2[0-6])(?:-.+)?$/',
        },
        {
          ...php2shellDockerRule,
          allowedVersions:
            '/^8\\.5\\.(?:1[2-9]|[2-9][0-9]|[1-9][0-9]{2,})(?:-.+)?$/',
          matchCurrentValue: '/^8\\.5\\.(?:[0-9]|1[01])(?:-.+)?$/',
        },
      ].flatMap((rule): PackageRule[] => [
        rule,
        {
          enabled: false,
          matchCurrentValue: rule.matchCurrentValue,
          matchDatasources: rule.matchDatasources,
          matchJsonata: rule.matchJsonata,
          matchPackageNames: rule.matchPackageNames,
          matchUpdateTypes: ['digest', 'pinDigest'],
        },
      ]),
    ],
  },
};

export const minimumReleaseAgeDatasourceNames = Object.keys(
  minimumReleaseAgeDatasources,
);
