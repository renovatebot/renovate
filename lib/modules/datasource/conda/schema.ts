import { z } from 'zod/v4';
import {
  DeepNullish,
  Json,
  LooseArray,
  LooseRecord,
} from '../../../util/schema-utils/index.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';

export const CondaFile = DeepNullish(
  z.object({
    version: z.string(),
    upload_time: z.string().optional(),
  }),
);

export const CondaPackage = DeepNullish(
  z.object({
    html_url: z.string().optional(),
    dev_url: z.string().optional(),
    files: LooseArray(CondaFile).optional(),
    versions: z.array(z.string()).optional(),
  }),
);

export type CondaPackage = z.infer<typeof CondaPackage>;

const RepodataPackage = z.object({
  name: z.string(),
  version: z.string(),
  /**
   * Normalized with `asTimestamp` in `mergeBuild` rather than declared as
   * `MaybeTimestamp` here: a build whose `timestamp` is malformed (`null` and
   * stringified numbers are both seen in the wild) must keep its version, and
   * a field schema that rejects it would make `LooseRecord` drop the whole
   * build - and with it possibly the only record of that version.
   */
  timestamp: z.unknown().optional(),
});

type RepodataPackage = z.infer<typeof RepodataPackage>;

/**
 * Parses a conda channel's per-platform `repodata.json` index into a map of
 * package name to its releases, merging the `packages` (`.tar.bz2`) and
 * `packages.conda` (`.conda`) sections and deduplicating versions.
 *
 * @see https://docs.conda.io/projects/conda-build/en/latest/concepts/generating-index.html
 */
export const Repodata = z
  .object({
    // `.catch({})` covers both an absent section and one that is present but
    // not an object, e.g. when a proxy answers with an error document
    packages: LooseRecord(RepodataPackage).catch({}),
    'packages.conda': LooseRecord(RepodataPackage).catch({}),
  })
  .transform(({ packages, 'packages.conda': packagesConda }) => {
    const releases = new Map<string, Map<string, Release>>();

    // iterated section by section: these indexes hold hundreds of thousands of
    // builds, so concatenating them into one array is not worth the copy
    for (const section of [packages, packagesConda]) {
      for (const entry of Object.values(section)) {
        let versions = releases.get(entry.name);
        if (!versions) {
          versions = new Map<string, Release>();
          releases.set(entry.name, versions);
        }

        mergeBuild(versions, entry);
      }
    }

    return releases;
  });

export type Repodata = z.infer<typeof Repodata>;

export const RepodataJson = Json.pipe(Repodata);

/**
 * Merges one build into the release for its version.
 *
 * A version normally has many builds, spread across both repodata sections and
 * often published far apart in time, so we report the earliest of their
 * timestamps: that is when the version first became installable from the
 * channel. Builds may also omit `timestamp` altogether - older `.tar.bz2`
 * builds predate the field - so a later build can be the first one to supply
 * it.
 */
function mergeBuild(
  versions: Map<string, Release>,
  entry: RepodataPackage,
): void {
  const releaseTimestamp =
    entry.timestamp === undefined ? null : asTimestamp(entry.timestamp);

  const release = versions.get(entry.version);
  if (!release) {
    versions.set(entry.version, {
      version: entry.version,
      releaseTimestamp: releaseTimestamp ?? undefined,
    });
    return;
  }

  // timestamps are normalized to UTC ISO-8601, so string order is time order
  if (
    releaseTimestamp &&
    (!release.releaseTimestamp || releaseTimestamp < release.releaseTimestamp)
  ) {
    release.releaseTimestamp = releaseTimestamp;
  }
}
