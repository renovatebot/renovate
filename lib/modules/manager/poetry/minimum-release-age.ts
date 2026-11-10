import { isNumber } from '@sindresorhus/is';
import { Duration } from 'luxon';
import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import {
  calculatePackageManagerMinimumReleaseAgeMs,
  getMinimumReleaseAgeExemption,
  isReleaseOldEnough,
} from '../../../util/minimum-release-age.ts';
import { toMs } from '../../../util/pretty-time.ts';
import { Result } from '../../../util/result.ts';
import { coerceString } from '../../../util/string.ts';
import { normalizePythonDepName } from '../../datasource/pypi/common.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { get } from '../../versioning/index.ts';
import * as poetryVersioning from '../../versioning/poetry/index.ts';
import type {
  ExtractedPackageRule,
  UpdateArtifactsConfig,
  Upgrade,
} from '../types.ts';
import { PoetryMinReleaseAgeConfig } from './schema.ts';

// Poetry reads `solver.min-release-age` since v2.4.0
// https://github.com/python-poetry/poetry/releases/tag/2.4.0
export const poetryMinReleaseAgeVersion = '2.4.0';

const noMinReleaseAgeConfig: PoetryMinReleaseAgeConfig = {
  days: 0,
  exclude: [],
};

/**
 * Reads the minimum release age settings of the `poetry.toml` next to `packageFile`.
 */
export async function readPoetryMinReleaseAgeConfig(
  packageFile: string,
): Promise<PoetryMinReleaseAgeConfig> {
  const configFile = getSiblingFileName(packageFile, 'poetry.toml');
  const content = await readLocalFile(configFile, 'utf8');
  if (!content) {
    return noMinReleaseAgeConfig;
  }
  const { val, err } = Result.parse(
    content,
    PoetryMinReleaseAgeConfig,
  ).unwrap();
  if (err) {
    logger.debug({ configFile, err }, 'Poetry: error parsing poetry.toml');
    return noMinReleaseAgeConfig;
  }
  return val;
}

/**
 * Returns the rules which set `minimumReleaseAgeExtracted` of PyPI packages to `solver.min-release-age`, and to `null` for the packages of `solver.min-release-age-exclude`.
 */
export function getPoetryMinReleaseAgeRules({
  days,
  exclude,
}: PoetryMinReleaseAgeConfig): ExtractedPackageRule[] {
  if (!days) {
    return [];
  }
  return [
    {
      matchDatasources: [PypiDatasource.id],
      minimumReleaseAgeExtracted: `${days} days`,
    },
    ...exclude.map((packageName) => ({
      matchDatasources: [PypiDatasource.id],
      matchPackageNames: [packageName],
      minimumReleaseAgeExtracted: null,
    })),
  ];
}

/**
 * Returns `POETRY_SOLVER_MIN_RELEASE_AGE` for the `minimumReleaseAge` of `config`, rounded up to whole days.
 */
function getConfigMinReleaseAgeEnv(
  config: UpdateArtifactsConfig,
): NodeJS.ProcessEnv {
  if (!config.minimumReleaseAge) {
    return {};
  }
  const ageMs = toMs(config.minimumReleaseAge);
  if (!isNumber(ageMs)) {
    logger.debug(
      { minimumReleaseAge: config.minimumReleaseAge },
      'Invalid minimumReleaseAge, skipping POETRY_SOLVER_MIN_RELEASE_AGE',
    );
    return {};
  }
  const days = Math.ceil(Duration.fromMillis(ageMs).as('days'));
  return { POETRY_SOLVER_MIN_RELEASE_AGE: days.toString() };
}

/**
 * Returns the `POETRY_SOLVER_MIN_RELEASE_AGE` which raises `solver.min-release-age` of the `poetry.toml` to the minimum release age of Renovate, and `POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE` for updated packages with a smaller `minimumReleaseAge` than the age which Poetry checks, or without `minimumReleaseAgePackageManagerSync` the `POETRY_SOLVER_MIN_RELEASE_AGE` for the `minimumReleaseAge` of `config`.
 */
export async function getMinReleaseAgeEnv(
  config: UpdateArtifactsConfig,
  packageFileName: string,
  updatedDeps: Upgrade[],
): Promise<NodeJS.ProcessEnv> {
  const ageMs = calculatePackageManagerMinimumReleaseAgeMs({
    config,
    manager: 'poetry',
    packageFile: packageFileName,
    upgrades: updatedDeps,
  });
  if (ageMs === null) {
    return getConfigMinReleaseAgeEnv(config);
  }
  // without an age, e.g. for security updates, Poetry applies its own config
  if (!ageMs) {
    return {};
  }
  const poetryConfig = await readPoetryMinReleaseAgeConfig(packageFileName);
  // the environment variable replaces `solver.min-release-age`, so Renovate never passes less
  const days = Math.max(
    Math.ceil(Duration.fromMillis(ageMs).as('days')),
    poetryConfig.days,
  );
  const minReleaseAgeEnv = toMinReleaseAgeEnv(days, poetryConfig.days);
  // Poetry checks no age for the packages of `solver.min-release-age-exclude`
  const exemption = getMinimumReleaseAgeExemption(
    updatedDeps.filter(
      (dep) => !poetryConfig.exclude.includes(getNormalizedName(dep)),
    ),
    'poetry',
    PypiDatasource.id,
    // the age which Poetry checks
    Duration.fromObject({ days }).as('milliseconds'),
  );
  if (!exemption) {
    return minReleaseAgeEnv;
  }
  const excluded: string[] = [];
  const notExcluded: string[] = [];
  for (const dep of exemption.upgrades) {
    const names = isExcludable(dep, poetryConfig.days) ? excluded : notExcluded;
    names.push(getNormalizedName(dep));
  }
  if (notExcluded.length) {
    logger.debug(
      `Not excluding ${notExcluded.join(', ')} from the Poetry minimum release age, as the constraint is not a single version or the release is younger than solver.min-release-age`,
    );
  }
  if (!excluded.length) {
    return minReleaseAgeEnv;
  }
  // the variable replaces `solver.min-release-age-exclude`, so it starts with the entries of the `poetry.toml`
  const exclude = [...new Set([...poetryConfig.exclude, ...excluded])];
  logger.debug(
    `Excluding ${excluded.join(', ')} from the Poetry minimum release age, as their minimumReleaseAge is smaller and their release is younger or has no timestamp`,
  );
  return {
    ...minReleaseAgeEnv,
    POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE: exclude.join(','),
  };
}

/**
 * Whether the constraint of `dep` pins a single version and its release is at least as old as the `solver.min-release-age` of `configDays`.
 */
function isExcludable(dep: Upgrade, configDays: number): boolean {
  return (
    isPinned(dep) &&
    isReleaseOldEnough(
      dep,
      Duration.fromObject({ days: configDays }).as('milliseconds'),
    )
  );
}

function isPinned(dep: Upgrade): boolean {
  if (!dep.newValue) {
    return false;
  }
  const versioning = get(dep.versioning ?? poetryVersioning.id);
  return versioning.isSingleVersion(dep.newValue);
}

/**
 * The normalized name of the package which Poetry resolves, which is `newName` for replacements.
 */
function getNormalizedName(dep: Upgrade): string {
  return normalizePythonDepName(
    coerceString(dep.newName ?? dep.packageName ?? dep.depName),
  );
}

/**
 * Returns `POETRY_SOLVER_MIN_RELEASE_AGE` for `days`, or nothing if `days` is the `solver.min-release-age` which Poetry applies itself.
 */
function toMinReleaseAgeEnv(
  days: number,
  configDays: number,
): NodeJS.ProcessEnv {
  return days > configDays
    ? { POETRY_SOLVER_MIN_RELEASE_AGE: days.toString() }
    : {};
}
