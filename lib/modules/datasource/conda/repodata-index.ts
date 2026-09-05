import type { ParsedElementInfo } from '@streamparser/json';
import { JSONParser } from '@streamparser/json';
import { asTimestamp } from '../../../util/timestamp.ts';
import type { Release } from '../types.ts';
import type { RepodataPackage } from './schema.ts';
import { RepodataPackage as RepodataPackageSchema } from './schema.ts';
import type { RepodataIndex } from './types.ts';

/**
 * Builds the index for one channel subdir from a `repodata.json` stream.
 *
 * These documents reach 500 MB and beyond uncompressed, which is past the
 * largest string V8 can hold, so they are never materialized: the stream is
 * tokenized and only the build records are kept.
 *
 * @see https://docs.conda.io/projects/conda-build/en/latest/concepts/generating-index.html
 */
export async function parseRepodataStream(
  source: AsyncIterable<Buffer | string>,
): Promise<RepodataIndex> {
  const index: RepodataIndex = new Map();

  // `$.*.*` visits the members of every top-level object, which is how both
  // `packages` and `packages.conda` are reached - the path syntax cannot
  // express a key that contains a dot. Build records are then told apart from
  // the members of the other sections (`info`, `removed`) by their shape, which
  // is also why the parser does not need to keep its stack.
  const parser = new JSONParser({ paths: ['$.*.*'], keepStack: false });

  parser.onValue = ({ value }: ParsedElementInfo): void => {
    const build = RepodataPackageSchema.safeParse(value);
    if (build.success) {
      addBuild(index, build.data);
    }
  };

  for await (const chunk of source) {
    // throws on malformed JSON, since no `onError` handler is registered
    parser.write(chunk);
  }

  return index;
}

function addBuild(index: RepodataIndex, entry: RepodataPackage): void {
  let versions = index.get(entry.name);
  if (!versions) {
    versions = new Map<string, Release>();
    index.set(entry.name, versions);
  }

  mergeBuild(versions, entry);
}

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
