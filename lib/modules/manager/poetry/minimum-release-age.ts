import { Duration } from 'luxon';
import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import {
  calculatePackageManagerMinimumReleaseAgeMs,
  getMinimumReleaseAgeExemption,
} from '../../../util/minimum-release-age.ts';
import { coerceNumber } from '../../../util/number.ts';
import { Result } from '../../../util/result.ts';
import { coerceString } from '../../../util/string.ts';
import { normalizePythonDepName } from '../../datasource/pypi/common.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import type {
  ExtractedPackageRule,
  UpdateArtifactsConfig,
  Upgrade,
} from '../types.ts';
import { PoetryMinReleaseAgeConfig } from './schema.ts';
import type { MinReleaseAgeEnv } from './types.ts';

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
 * Returns the `POETRY_SOLVER_MIN_RELEASE_AGE` which raises `solver.min-release-age` of the `poetry.toml` to the minimum release age of Renovate, lowered to the smaller `minimumReleaseAge` of exempted updates, and the notice for such a lowering.
 */
export async function getMinReleaseAgeEnv(
  config: UpdateArtifactsConfig,
  packageFileName: string,
  updatedDeps: Upgrade[],
): Promise<MinReleaseAgeEnv> {
  const ageMs = calculatePackageManagerMinimumReleaseAgeMs({
    config,
    manager: 'poetry',
    packageFile: packageFileName,
    upgrades: updatedDeps,
  });
  // without an age, e.g. for security updates, Poetry applies its own config
  if (!ageMs) {
    return { env: {} };
  }
  const poetryConfig = await readPoetryMinReleaseAgeConfig(packageFileName);
  // the environment variable replaces `solver.min-release-age`, so Renovate never passes less
  const days = Math.max(
    Math.ceil(Duration.fromMillis(ageMs).as('days')),
    poetryConfig.days,
  );
  // Poetry checks no age for the packages of `solver.min-release-age-exclude`
  const exemption = getMinimumReleaseAgeExemption(
    updatedDeps.filter(
      (dep) =>
        !poetryConfig.exclude.includes(
          normalizePythonDepName(coerceString(dep.packageName ?? dep.depName)),
        ),
    ),
    'poetry',
    ageMs,
  );
  // rounds down, so that Poetry accepts the releases of the exempted updates
  const loweredDays = Math.max(
    Math.floor(Duration.fromMillis(coerceNumber(exemption?.ageMs)).as('days')),
    poetryConfig.days,
  );
  if (!exemption || loweredDays >= days) {
    return { env: toMinReleaseAgeEnv(days, poetryConfig.days) };
  }
  logger.debug(
    `Lowering the Poetry minimum release age from ${days} to ${loweredDays} days, as the minimumReleaseAge of ${exemption.depNames.join(', ')} is smaller and their release is younger or has no timestamp`,
  );
  const packages = exemption.depNames.map((name) => `\`${name}\``).join(', ');
  return {
    env: toMinReleaseAgeEnv(loweredDays, poetryConfig.days),
    notice: `Poetry checked a minimum release age of ${loweredDays} days instead of ${days} for this update, because the \`minimumReleaseAge\` of ${packages} is smaller.`,
  };
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
