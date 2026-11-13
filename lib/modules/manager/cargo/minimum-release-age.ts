import { isNonEmptyString, isString } from '@sindresorhus/is';
import { escape as escapeGlob } from 'minimatch';
import { logger } from '../../../logger/index.ts';
import { getEnv } from '../../../util/env.ts';
import { detachUrlCredentials } from '../../../util/host-rules.ts';
import {
  calculateMinimumReleaseAgeMs,
  calculatePackageManagerMinimumReleaseAgeMs,
  getMinimumReleaseAgeExemption,
} from '../../../util/minimum-release-age.ts';
import { coerceNumber } from '../../../util/number.ts';
import { coerceObject } from '../../../util/object.ts';
import { regEx } from '../../../util/regex.ts';
import { CrateDatasource } from '../../datasource/crate/index.ts';
import { isSubsetOf } from '../../versioning/common.ts';
import { api as rustVersioning } from '../../versioning/rust-release-channel/index.ts';
import type {
  ExtractedPackageRule,
  UpdateArtifactsConfig,
  Upgrade,
} from '../types.ts';
import { resolveToolConstraint } from '../util.ts';
import type { CargoConfig } from './schema.ts';
import type {
  CargoManagerData,
  MinPublishAgeEnv,
  MinPublishAgeEnvOptions,
} from './types.ts';
import { DEFAULT_REGISTRY_ID, readCargoConfig } from './utils.ts';

// Cargo respects `min-publish-age` since Rust 1.100.0
// https://github.com/rust-lang/cargo/pull/17335
export const minPublishAgeRustRange = '>=1.100.0';

const units = [
  { name: 'days', ms: 24 * 60 * 60 * 1000 },
  { name: 'hours', ms: 60 * 60 * 1000 },
  { name: 'minutes', ms: 60 * 1000 },
];

// cargo counts a month as 2,629,746 seconds, `toMs` as 30 days
const cargoMonthSeconds = 2_629_746;

// the durations which cargo accepts besides `"0"`, see `maybe_parse_time_span` in cargo's src/util/time_span.rs
const cargoDurationRegex = regEx(
  /^(?<count>\d+) ?(?<unit>second|minute|hour|day|week|month)s?$/,
);

const cargoUnitSeconds: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 60 * 60,
  day: 24 * 60 * 60,
  week: 7 * 24 * 60 * 60,
  month: cargoMonthSeconds,
};

/**
 * Parses a cargo duration like `3 days` to milliseconds, or returns `null` if cargo rejects it.
 */
function parseCargoDurationMs(age: string): number | null {
  if (age === '0') {
    return 0;
  }
  const groups = cargoDurationRegex.exec(age)?.groups;
  return groups
    ? parseInt(groups.count, 10) * cargoUnitSeconds[groups.unit] * 1000
    : null;
}

/**
 * Parses a cargo `min-publish-age`: the age, with months converted to seconds, `null` for `"0"`, which turns the check off, or `undefined` if it is unset or invalid.
 */
function parseMinPublishAge(
  age: string | undefined,
  key: string,
): string | null | undefined {
  if (!isNonEmptyString(age)) {
    return undefined;
  }
  const ageMs = parseCargoDurationMs(age);
  if (ageMs === null) {
    logger.debug(`Invalid ${key} in cargo config: ${age}`);
    return undefined;
  }
  if (!ageMs) {
    return null;
  }
  // `toMs` reads the other units of cargo like cargo does
  return age.includes('month') ? `${ageMs / 1000} seconds` : age;
}

/**
 * Returns `registry.global-min-publish-age` of the cargo config, or `null` if it is unset, `"0"` or invalid.
 */
export function getGlobalMinPublishAge(
  cargoConfig: CargoConfig,
): string | null {
  return (
    parseMinPublishAge(
      cargoConfig.registry?.['global-min-publish-age'],
      'registry.global-min-publish-age',
    ) ?? null
  );
}

/**
 * Returns the `min-publish-age` which cargo applies to the crates of a registry: the one of the registry, or else `globalAge`.
 */
function getEffectiveMinPublishAge(
  cargoConfig: CargoConfig,
  registryName: string,
  globalAge: string | null,
): string | null {
  const age = parseMinPublishAge(
    cargoConfig.registries?.[registryName]?.['min-publish-age'],
    `registries.${registryName}.min-publish-age`,
  );
  return age === undefined ? globalAge : age;
}

/**
 * Returns the rules which set `minimumReleaseAgeExtracted` of each crate to the `min-publish-age` which cargo applies to it.
 *
 * @param registryUrls The URL of each registry other than crates.io by name, as the cargo extractor sets it in `registryUrls` of the crates of that registry.
 * @param cratesIoUrl The URL which the crates of crates.io have in `registryUrls` if the cargo config replaces crates.io.
 */
export function getMinPublishAgeRules(
  cargoConfig: CargoConfig,
  registryUrls: Record<string, string>,
  cratesIoUrl?: string,
): ExtractedPackageRule[] {
  const globalAge = getGlobalMinPublishAge(cargoConfig);
  const cratesIoAge = getEffectiveMinPublishAge(
    cargoConfig,
    DEFAULT_REGISTRY_ID,
    globalAge,
  );
  const cratesIoAgeMs = calculateMinimumReleaseAgeMs({
    minimumReleaseAge: cratesIoAge,
  });
  const rules: ExtractedPackageRule[] = [];
  // the age of crates.io applies to all crates, and the rules per registry override it for the crates of other registries
  if (cratesIoAge) {
    rules.push({
      matchDatasources: [CrateDatasource.id],
      minimumReleaseAgeExtracted: cratesIoAge,
    });
  }
  for (const [registryName, registryUrl] of Object.entries(registryUrls)) {
    const age = getEffectiveMinPublishAge(cargoConfig, registryName, globalAge);
    // cargo applies the age of crates.io to its crates also if they come from a replacement with the URL of this registry, so the rule may only raise their age
    if (
      registryUrl === cratesIoUrl &&
      calculateMinimumReleaseAgeMs({ minimumReleaseAge: age }) <= cratesIoAgeMs
    ) {
      continue;
    }
    // an age of `"0"` is `null`, and only needs a rule to override the age of crates.io
    if (age ?? cratesIoAge) {
      rules.push({
        matchDatasources: [CrateDatasource.id],
        // the dependencies lose the credentials of their registry URL before the lookup, and the matcher reads a URL as a glob, e.g. the brackets of an IPv6 address, so the credentials go before the escaping
        matchRegistryUrls: [
          escapeGlob(detachUrlCredentials(registryUrl, []), {
            magicalBraces: true,
          }),
        ],
        minimumReleaseAgeExtracted: age,
      });
    }
  }
  return rules;
}

/**
 * Returns the `registries.<name>.min-publish-age` values of the cargo config by registry name, or `undefined` if no registry sets one.
 */
export function getRegistryMinPublishAges(
  cargoConfig: CargoConfig,
): Record<string, string> | undefined {
  const ages: Record<string, string> = {};
  for (const [name, registry] of Object.entries(
    coerceObject(cargoConfig.registries),
  )) {
    const age = registry['min-publish-age'];
    if (isString(age)) {
      ages[name] = age;
    }
  }
  return Object.keys(ages).length ? ages : undefined;
}

/**
 * Whether the cargo config sets `resolver.incompatible-publish-age = "allow"`, which turns off the check of `min-publish-age`.
 */
function allowsIncompatiblePublishAge(cargoConfig: CargoConfig): boolean {
  return cargoConfig.resolver?.['incompatible-publish-age'] === 'allow';
}

/**
 * Formats a duration as a cargo `min-publish-age`, using the largest unit which keeps it a whole number.
 */
function toCargoDuration(durationMs: number): string {
  // `toMs` returns fractions of a millisecond for an age like `1.1 hours`
  const wholeMs = Math.round(durationMs);
  for (const unit of units) {
    if (wholeMs % unit.ms === 0) {
      return `${wholeMs / unit.ms} ${unit.name}`;
    }
  }
  return `${Math.ceil(wholeMs / 1000)} seconds`;
}

/**
 * Whether the cargo config sets a valid `min-publish-age` for the registry of `upgrade`, which takes precedence over `CARGO_REGISTRY_GLOBAL_MIN_PUBLISH_AGE`.
 */
function hasRegistryMinPublishAge(
  cargoConfig: CargoConfig,
  upgrade: Upgrade<CargoManagerData>,
): boolean {
  const registryName = upgrade.managerData?.registryName ?? DEFAULT_REGISTRY_ID;
  return (
    parseMinPublishAge(
      cargoConfig.registries?.[registryName]?.['min-publish-age'],
      `registries.${registryName}.min-publish-age`,
    ) !== undefined
  );
}

/**
 * Returns `CARGO_REGISTRY_GLOBAL_MIN_PUBLISH_AGE` with `CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE=deny` for `ageMs`, or nothing if `ageMs` is not larger than `appliedConfigAgeMs`, the age which cargo applies itself.
 */
function toMinPublishAgeEnv(
  ageMs: number,
  appliedConfigAgeMs: number,
): Record<string, string> {
  if (ageMs <= appliedConfigAgeMs) {
    return {};
  }
  return {
    CARGO_REGISTRY_GLOBAL_MIN_PUBLISH_AGE: toCargoDuration(ageMs),
    // `deny` is the default, set it to override an `allow` in the cargo config
    CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE: 'deny',
  };
}

/**
 * Returns the environment variables which pass the minimum release age of `calculatePackageManagerMinimumReleaseAgeMs`, raised to `registry.global-min-publish-age`, to cargo, lowered to the smaller `minimumReleaseAge` of exempted crates but not below `registry.global-min-publish-age`, and the notice for such a lowering if `rustConstraint` is within `minPublishAgeRustRange`. Returns nothing without `minimumReleaseAgePackageManagerSync`.
 */
export async function getMinPublishAgeEnv(
  options: MinPublishAgeEnvOptions,
): Promise<MinPublishAgeEnv> {
  const renovateAgeMs = calculatePackageManagerMinimumReleaseAgeMs(options);
  // without minimumReleaseAgePackageManagerSync or without an age, e.g. for
  // security updates, cargo applies its own config
  if (!renovateAgeMs) {
    return { env: {} };
  }
  const cargoConfig = coerceObject(await readCargoConfig());
  const configAgeMs = calculateMinimumReleaseAgeMs({
    minimumReleaseAge: getGlobalMinPublishAge(cargoConfig),
  });
  // the environment variable replaces `registry.global-min-publish-age`, so it must not weaken it
  const ageMs = Math.max(renovateAgeMs, configAgeMs);
  // `allow` turns the check off unless the environment sets `deny`, so cargo applies no age of its own then
  const appliedConfigAgeMs = allowsIncompatiblePublishAge(cargoConfig)
    ? 0
    : configAgeMs;
  // the `min-publish-age` of a registry takes precedence over the environment variable, so lowering it does not help the crates of that registry
  const exemption = getMinimumReleaseAgeExemption(
    options.upgrades.filter(
      (upgrade) => !hasRegistryMinPublishAge(cargoConfig, upgrade),
    ),
    'cargo',
    CrateDatasource.id,
    ageMs,
  );
  const loweredMs = Math.max(coerceNumber(exemption?.ageMs), configAgeMs);
  if (!exemption || loweredMs >= ageMs) {
    return { env: toMinPublishAgeEnv(ageMs, appliedConfigAgeMs) };
  }
  const age = toCargoDuration(ageMs);
  const checked = loweredMs
    ? `a publish age of ${toCargoDuration(loweredMs)}`
    : 'no publish age';
  logger.debug(
    `Cargo checks ${checked} instead of ${age}, as the minimumReleaseAge of ${exemption.depNames.join(', ')} is smaller and their release is younger or has no timestamp`,
  );
  const env = toMinPublishAgeEnv(loweredMs, appliedConfigAgeMs);
  // cargo before Rust 1.100.0 ignores the environment variables, so it checks
  // nothing which the notice could name
  if (
    !isSubsetOf(rustVersioning, options.rustConstraint, minPublishAgeRustRange)
  ) {
    return { env };
  }
  const crates = exemption.depNames.map((crate) => `\`${crate}\``).join(', ');
  return {
    env,
    notice: `Cargo checked ${checked} instead of ${age} for this update, because the \`minimumReleaseAge\` of ${crates} is smaller.`,
  };
}

interface CargoEnforcesMinimumReleaseAgeConfig extends UpdateArtifactsConfig {
  managerData?: CargoManagerData;
}

/**
 * Whether no registry of the cargo config has a `min-publish-age` which is invalid, `"0"` or smaller than the `minimumReleaseAge` of lock file maintenance, as the environment variable cannot override it.
 */
function registriesEnforceMinimumReleaseAge(
  config: CargoEnforcesMinimumReleaseAgeConfig,
): boolean {
  // the age which Renovate would wait for, `minimumReleaseAgePackageManager` only raises what it passes
  const lockFileMaintenanceAgeMs = calculateMinimumReleaseAgeMs({
    minimumReleaseAge: config.minimumReleaseAge,
  });
  const registryAges = coerceObject(config.managerData?.registryMinPublishAges);
  for (const [registry, age] of Object.entries(registryAges)) {
    const ageMs = parseCargoDurationMs(age);
    if (ageMs === null) {
      logger.debug(
        `Cargo does not enforce the minimum release age, as registry ${registry} has an invalid min-publish-age ${age}`,
      );
      return false;
    }
    if (ageMs === 0) {
      logger.debug(
        `Cargo does not enforce the minimum release age, as the min-publish-age 0 of registry ${registry} turns the check off for that registry like allow, so Renovate does not rely on cargo`,
      );
      return false;
    }
    if (ageMs < lockFileMaintenanceAgeMs) {
      logger.debug(
        `Cargo does not enforce the minimum release age, as the min-publish-age ${age} of registry ${registry} is smaller than the minimumReleaseAge of lock file maintenance, and takes precedence over the age which Renovate passes`,
      );
      return false;
    }
  }
  return true;
}

const minPublishAgeEnvKeys = [
  'CARGO_REGISTRY_GLOBAL_MIN_PUBLISH_AGE',
  'CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE',
];

/**
 * Returns the publish age variable which the environment of Renovate, `customEnvVariables` or `env` sets, as it overrides the value which Renovate passes.
 */
function getUserSetMinPublishAgeEnvKey(): string | undefined {
  const env = getEnv();
  return minPublishAgeEnvKeys.find((key) => isString(env[key]));
}

/**
 * Whether cargo enforces the minimum release age when it regenerates the lock file, which requires a Rust constraint of at least `minPublishAgeRustRange`, a lock file without git sources, no publish age variable set by the environment of Renovate, `customEnvVariables` or `env`, and no registry of the cargo config with a `min-publish-age` which is invalid, `"0"` or smaller than the `minimumReleaseAge` of lock file maintenance.
 */
export async function enforcesMinimumReleaseAge(
  config: CargoEnforcesMinimumReleaseAgeConfig,
): Promise<boolean> {
  if (config.managerData?.lockFileHasGitSources) {
    logger.debug(
      'Cargo does not enforce the minimum release age, as the lock file has packages from git repositories, which cargo updates without checking their age',
    );
    return false;
  }
  const userSetKey = getUserSetMinPublishAgeEnvKey();
  if (userSetKey) {
    logger.debug(
      `Cargo does not enforce the minimum release age, as ${userSetKey} is set by the environment of Renovate, customEnvVariables or env, which overrides the value which Renovate passes`,
    );
    return false;
  }
  if (!registriesEnforceMinimumReleaseAge(config)) {
    return false;
  }
  const constraint = await resolveToolConstraint(config, 'rust');
  return isSubsetOf(rustVersioning, constraint, minPublishAgeRustRange);
}
