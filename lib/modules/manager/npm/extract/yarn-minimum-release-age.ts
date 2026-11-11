import { isNumber, isString } from '@sindresorhus/is';
import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import { readLocalFile } from '../../../../util/fs/index.ts';
import { coerceObject } from '../../../../util/object.ts';
import { regEx } from '../../../../util/regex.ts';
import { matchRegexOrGlobList } from '../../../../util/string-match.ts';
import { NpmDatasource } from '../../../datasource/npm/index.ts';
import { intersectsWith } from '../../../versioning/common.ts';
import { api as npmVersioning } from '../../../versioning/npm/index.ts';
import type {
  ExtractConfig,
  ExtractedPackageRule,
  PackageFile,
} from '../../types.ts';
import { resolveToolConstraint } from '../../util.ts';
import { DAY_MS, MINUTE_MS } from '../constants.ts';
import { YarnrcMinimalAgeGate } from '../schema.ts';
import type { NpmManagerData } from '../types.ts';
import type {
  YarnMinimalAgeGateSettings,
  YarnPreapprovedPackage,
  YarnrcMinimalAgeGateSettings,
} from './types.ts';
import { groupByLockFile } from './utils.ts';

// Yarn defaults `npmMinimalAgeGate` to 1 day since v4.15.0
export const yarnDefaultMinimalAgeGateRange = '>=4.15.0';
export const yarnDefaultMinimalAgeGateMinutes = 1440;

// Yarn reads `npmMinimalAgeGate` per scope of `npmScopes` since v4.17.0, and
// applies the default of 1 day to each listed scope without its own value
export const yarnScopeMinimalAgeGateRange = '>=4.17.0';

const durationUnitMs: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: MINUTE_MS,
  h: 60 * MINUTE_MS,
  d: DAY_MS,
  w: 7 * DAY_MS,
};
const durationRegex = regEx(/^(?<num>\d*\.?\d+)(?<unit>ms|s|m|h|d|w)?$/);

// the descriptor syntax of Yarn, like `foo`, `@scope/*` or `foo@^1.0.0`
const descriptorRegex = regEx(
  /^(?:@(?<scope>[^/]+?)\/)?(?<name>[^@/]+?)(?:@(?<range>.+))?$/,
);

/**
 * Parses a Yarn duration like `3d` to minutes like Yarn, where a number without a unit is in minutes, or returns `null` for a value which Yarn rejects.
 */
export function parseYarnDurationMinutes(value: unknown): number | null {
  // Yarn reads every value of the `.yarnrc.yml` as a string
  const text = isNumber(value) ? String(value) : value;
  if (!isString(text)) {
    return null;
  }
  const match = durationRegex.exec(text)?.groups;
  if (!match) {
    return null;
  }
  const num = parseFloat(match.num);
  if (!match.unit) {
    return num;
  }
  return (num * durationUnitMs[match.unit]) / MINUTE_MS;
}

function getMinutes(
  value: unknown,
  setting: string,
  yarnrcFile: string,
): number | null {
  if (value === undefined) {
    return null;
  }
  const minutes = parseYarnDurationMinutes(value);
  if (minutes === null) {
    logger.debug(
      `Invalid ${setting} ${JSON.stringify(value)} in ${yarnrcFile}, ignoring`,
    );
  }
  return minutes;
}

/**
 * Reads the minimum release age settings of the `.yarnrc.yml` next to a Yarn lock file, and ignores invalid ages.
 */
export async function readYarnrcMinimalAgeGate(
  yarnLock: string,
): Promise<YarnrcMinimalAgeGateSettings> {
  const yarnrcFile = upath.join(upath.dirname(yarnLock), '.yarnrc.yml');
  const content = await readLocalFile(yarnrcFile, 'utf8');
  if (!content) {
    return {};
  }
  const parsed = YarnrcMinimalAgeGate.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { yarnrcFile, err: parsed.error },
      'Failed to parse the minimum release age of .yarnrc.yml',
    );
    return {};
  }
  const { npmMinimalAgeGate, npmPreapprovedPackages, npmScopes } = parsed.data;
  const settings: YarnrcMinimalAgeGateSettings = {};
  const minutes = getMinutes(
    npmMinimalAgeGate,
    'npmMinimalAgeGate',
    yarnrcFile,
  );
  if (minutes !== null) {
    settings.npmMinimalAgeGate = minutes;
  }
  if (npmScopes) {
    settings.npmScopes = {};
    for (const [scope, scopeConfig] of Object.entries(npmScopes)) {
      settings.npmScopes[scope] = getMinutes(
        scopeConfig.npmMinimalAgeGate,
        `npmScopes.${scope}.npmMinimalAgeGate`,
        yarnrcFile,
      );
    }
  }
  if (npmPreapprovedPackages) {
    settings.npmPreapprovedPackages = npmPreapprovedPackages;
  }
  return settings;
}

/**
 * Whether Renovate runs Yarn 1 for the Yarn constraint, which is the case for a missing constraint, a constraint which is no valid range, or one which allows Yarn 1.
 */
export function isYarn1Constraint(
  yarnConstraint: string | null | undefined,
): boolean {
  const range = semver.validRange(yarnConstraint);
  const minVersion = range && semver.minVersion(range);
  return !minVersion || minVersion.major === 1;
}

/**
 * The global `npmMinimalAgeGate` in minutes which Yarn configures itself, or with `includeDefault` the Yarn default if the `.yarnrc.yml` does not set it.
 */
export function getYarnMinimalAgeGateMinutes(
  settings: YarnMinimalAgeGateSettings,
  includeDefault: boolean,
): number | undefined {
  if (settings.npmMinimalAgeGate !== undefined) {
    return settings.npmMinimalAgeGate;
  }
  return includeDefault ? yarnDefaultMinimalAgeGateMinutes : undefined;
}

/**
 * Returns the `npmMinimalAgeGate` in minutes of each scope of `npmScopes`, which Yarn applies to the packages of that scope instead of the global value, with the Yarn default for a scope without its own value if `includeDefault` is set.
 */
export function getYarnScopeMinimalAgeGateMinutes(
  settings: YarnMinimalAgeGateSettings,
  includeDefault: boolean,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [scope, minutes] of Object.entries(
    coerceObject(settings.npmScopes),
  )) {
    if (minutes !== null) {
      result[scope] = minutes;
    } else if (includeDefault) {
      result[scope] = yarnDefaultMinimalAgeGateMinutes;
    }
  }
  return result;
}

/**
 * Parses the `npmPreapprovedPackages` entries of a `.yarnrc.yml` like Yarn, which accepts a package name or glob, where `*` does not match `/` as in `matchPackageNames`, optionally with a semver range like `foo@^1.0.0`.
 */
export function parseYarnPreapprovedPackages(
  entries: string[] | undefined,
): YarnPreapprovedPackage[] {
  const result: YarnPreapprovedPackage[] = [];
  for (const entry of coerceArray(entries)) {
    const match = descriptorRegex.exec(entry)?.groups;
    if (!match) {
      logger.debug(`Invalid npmPreapprovedPackages entry ${entry}, ignoring`);
      continue;
    }
    const packageName = match.scope
      ? `@${match.scope}/${match.name}`
      : match.name;
    result.push(
      match.range ? { packageName, range: match.range } : { packageName },
    );
  }
  return result;
}

function isPreapprovedBy(
  entry: YarnPreapprovedPackage,
  packageName: string,
  version: string | undefined,
): boolean {
  if (!matchRegexOrGlobList(packageName, [entry.packageName])) {
    return false;
  }
  if (!entry.range) {
    return true;
  }
  return !!version && semver.satisfies(version, entry.range);
}

/**
 * Whether `npmPreapprovedPackages` exempts `version` of `packageName` from the Yarn minimum release age.
 */
export function isYarnPreapproved(
  preapproved: YarnPreapprovedPackage[],
  packageName: string,
  version: string | undefined,
): boolean {
  return preapproved.some((entry) =>
    isPreapprovedBy(entry, packageName, version),
  );
}

/**
 * Returns the `packageRules` for a Yarn minimum release age of npm packages, with the age of `npmScopes` for the packages of a scope, and with `npmPreapprovedPackages` entries without a range lifting it for the packages they name.
 */
export function getYarnMinimumReleaseAgeRules(
  minutes: number | undefined,
  scopeMinutes: Record<string, number>,
  preapproved: YarnPreapprovedPackage[],
): ExtractedPackageRule[] {
  const scopes = Object.entries(scopeMinutes);
  if (!minutes && !scopes.some(([, scopeAge]) => scopeAge)) {
    return [];
  }
  const rules: ExtractedPackageRule[] = [];
  if (minutes) {
    rules.push({
      matchDatasources: [NpmDatasource.id],
      minimumReleaseAgeExtracted: `${minutes} minutes`,
    });
  }
  for (const [scope, scopeAge] of scopes) {
    rules.push({
      matchDatasources: [NpmDatasource.id],
      matchPackageNames: [`@${scope}/**`],
      minimumReleaseAgeExtracted: scopeAge ? `${scopeAge} minutes` : null,
    });
  }
  for (const entry of preapproved) {
    if (!entry.range) {
      rules.push({
        matchDatasources: [NpmDatasource.id],
        matchPackageNames: [entry.packageName],
        minimumReleaseAgeExtracted: null,
      });
    }
  }
  return rules;
}

/**
 * Adds `packageRules` with the Yarn minimum release age to the package files of each Yarn lock file, from the `.yarnrc.yml` next to it or the Yarn default, and keeps the settings of the lock file in the `managerData` of each of its package files, except for Yarn 1, which has no minimum release age.
 */
export async function setYarnMinimumReleaseAge(
  packageFiles: Partial<PackageFile<NpmManagerData>>[],
  config: ExtractConfig,
): Promise<void> {
  for (const {
    lockFile: yarnLock,
    packageFiles: lockFilePackageFiles,
    root,
  } of groupByLockFile(packageFiles, 'yarnLock')) {
    const yarnConstraint = await resolveToolConstraint(
      config,
      'yarn',
      () => root?.extractedConstraints?.yarn,
    );
    if (isYarn1Constraint(yarnConstraint)) {
      continue;
    }
    const settings = await readYarnrcMinimalAgeGate(yarnLock);
    const { npmMinimalAgeGate, npmScopes } = settings;
    const hasNpmPreapprovedPackages = !!settings.npmPreapprovedPackages?.length;
    // the .yarnrc.yml has no Yarn constraint of its own, so the root
    // package.json sets it for every package file of the lock file
    for (const packageFile of lockFilePackageFiles) {
      packageFile.managerData!.yarnMinimalAgeGate = {
        npmMinimalAgeGate,
        npmScopes,
        ...(hasNpmPreapprovedPackages && { hasNpmPreapprovedPackages }),
        yarnConstraint,
      };
    }
    // a Yarn range which allows a version with a default gets it, as Renovate
    // may install that version
    const minutes = getYarnMinimalAgeGateMinutes(
      settings,
      intersectsWith(
        npmVersioning,
        yarnConstraint,
        yarnDefaultMinimalAgeGateRange,
      ),
    );
    const scopeMinutes = getYarnScopeMinimalAgeGateMinutes(
      settings,
      intersectsWith(
        npmVersioning,
        yarnConstraint,
        yarnScopeMinimalAgeGateRange,
      ),
    );
    const rules = getYarnMinimumReleaseAgeRules(
      minutes,
      scopeMinutes,
      parseYarnPreapprovedPackages(settings.npmPreapprovedPackages),
    );
    if (!rules.length) {
      continue;
    }
    const globalAge = minutes ? `${minutes} minutes` : 'none';
    const scopeAges = Object.entries(scopeMinutes).map(
      ([scope, scopeAge]) => `@${scope} ${scopeAge} minutes`,
    );
    const scopeAgesText = scopeAges.length
      ? `, scopes ${scopeAges.join(', ')}`
      : '';
    logger.debug(
      `Found Yarn minimum release age for ${yarnLock}: global ${globalAge}${scopeAgesText}`,
    );
    for (const packageFile of lockFilePackageFiles) {
      packageFile.packageRules = [
        ...coerceArray(packageFile.packageRules),
        ...rules,
      ];
    }
  }
}
