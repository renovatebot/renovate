import { isNonEmptyString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { getEnv } from '../../../util/env.ts';
import { calculateMinimumReleaseAgeMs } from '../../../util/minimum-release-age.ts';
import { toMs } from '../../../util/pretty-time.ts';
import { api as rustVersioning } from '../../versioning/rust-release-channel/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { resolveToolConstraint } from '../util.ts';
import type { CargoConfig } from './schema.ts';

// Cargo respects `min-publish-age` since Rust 1.100.0
// https://github.com/rust-lang/cargo/pull/17335
export const minPublishAgeRustRange = '>=1.100.0';

const units = [
  { name: 'days', ms: 24 * 60 * 60 * 1000 },
  { name: 'hours', ms: 60 * 60 * 1000 },
  { name: 'minutes', ms: 60 * 1000 },
];

/**
 * Returns `registry.global-min-publish-age` of the cargo config, or `undefined` if it is unset, `"0"` or invalid.
 */
export function getGlobalMinPublishAge(
  cargoConfig: CargoConfig,
): string | undefined {
  const age = cargoConfig.registry?.['global-min-publish-age'];
  if (!isNonEmptyString(age)) {
    return undefined;
  }
  const ageMs = toMs(age);
  if (!ageMs) {
    if (ageMs === null) {
      logger.debug(`Invalid global-min-publish-age in cargo config: ${age}`);
    }
    return undefined;
  }
  return age;
}

/**
 * Formats a duration as a cargo `min-publish-age`, using the largest unit which keeps it a whole number.
 */
function toCargoDuration(durationMs: number): string {
  for (const unit of units) {
    if (durationMs % unit.ms === 0) {
      return `${durationMs / unit.ms} ${unit.name}`;
    }
  }
  return `${Math.ceil(durationMs / 1000)} seconds`;
}

/**
 * The environment variables which make cargo enforce the larger of `minimumReleaseAge` and `minimumReleaseAgeExtracted`.
 */
export function getMinPublishAgeEnv(
  config: Pick<
    UpdateArtifactsConfig,
    'minimumReleaseAge' | 'minimumReleaseAgeExtracted'
  >,
): Record<string, string> {
  // `minimumReleaseAgeBuffer` only applies to Renovate's own checks
  const minimumReleaseAgeMs = calculateMinimumReleaseAgeMs({
    minimumReleaseAge: config.minimumReleaseAge,
    minimumReleaseAgeExtracted: config.minimumReleaseAgeExtracted,
  });
  if (!minimumReleaseAgeMs) {
    return {};
  }
  return {
    CARGO_REGISTRY_GLOBAL_MIN_PUBLISH_AGE: toCargoDuration(minimumReleaseAgeMs),
    // `deny` is the default, set it to override an `allow` in the cargo config
    CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE: 'deny',
  };
}

/**
 * Whether cargo enforces the minimum release age when it regenerates the lock file.
 *
 * Requires `RENOVATE_X_CARGO_MIN_PUBLISH_AGE` and a Rust constraint of at least `minPublishAgeRustRange`.
 */
export async function enforcesMinimumReleaseAge(
  config: UpdateArtifactsConfig,
): Promise<boolean> {
  if (!getEnv().RENOVATE_X_CARGO_MIN_PUBLISH_AGE) {
    return false;
  }
  const constraint = await resolveToolConstraint(config, 'rust');
  return (
    isNonEmptyString(constraint) &&
    rustVersioning.isValid(constraint) &&
    rustVersioning.subset(constraint, minPublishAgeRustRange) === true
  );
}
