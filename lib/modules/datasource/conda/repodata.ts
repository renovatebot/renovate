import { pipeline } from 'node:stream/promises';
import { createZstdDecompress } from 'node:zlib';
import is from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import type { Http } from '../../../util/http/index.ts';
import { HttpError } from '../../../util/http/index.ts';
import { joinUrlParts, parseUrl } from '../../../util/url.ts';
import type { Release, ReleaseResult } from '../types.ts';
import { platformsParam } from './common.ts';
import { parseRepodataStream } from './repodata-index.ts';
import type { RepodataIndex } from './types.ts';

/** Subdir holding the builds that work on every platform. */
const noarch = 'noarch';

interface Channel {
  channelUrl: string;
  platforms: string[];
}

/**
 * Looks up a package in a standard conda channel that serves per-platform
 * `repodata.json` indexes (e.g. self-hosted mirrors or Artifactory conda
 * repos), as opposed to the Anaconda.org REST API or prefix.dev.
 *
 * `registryUrl` either points at a single channel subdir, or at a channel root
 * carrying a `platforms` parameter, in which case the subdirs for those
 * platforms plus `noarch` are reconciled here. Each parsed index is memoized
 * for the repository, so every dependency in a subdir reuses one download.
 */
export async function getReleases(
  http: Http,
  registryUrl: string,
  packageName: string,
): Promise<ReleaseResult | null> {
  const channel = parseChannelUrl(registryUrl);

  const versions = channel
    ? await getChannelVersions(http, channel, packageName)
    : (await loadIndex(http, registryUrl))?.get(packageName);

  if (!versions?.size) {
    return null;
  }

  return {
    // standard conda channels are self-hosted, so their contents must not be
    // written to the shared package cache
    isPrivate: true,
    // indexes are memoized for the repository and callers such as
    // `mergeRegistries` mutate the releases they are given, so hand out copies
    releases: [...versions.values()].map((release) => ({ ...release })),
  };
}

/**
 * A `registryUrl` may point at one channel subdir, or at a channel root with a
 * `platforms` parameter naming the platforms the workspace targets - which is
 * what the pixi manager emits. Returns `null` for the former.
 */
function parseChannelUrl(registryUrl: string): Channel | null {
  const url = parseUrl(registryUrl);
  if (!url) {
    return null;
  }

  const platforms = url.searchParams.get(platformsParam);
  if (platforms === null) {
    return null;
  }

  // the parameter gives Renovate context and is not part of the channel URL
  url.searchParams.delete(platformsParam);

  return {
    channelUrl: url.toString(),
    platforms: platforms
      .split(',')
      .map((platform) => platform.trim())
      .filter(is.nonEmptyString),
  };
}

/**
 * Reconciles the subdirs of one channel into the versions that are usable.
 *
 * A version is only offered when it is installable on every targeted platform,
 * meaning it is present in that platform's own subdir or in `noarch`. Anything
 * less would propose an update the workspace cannot solve. Anything more - such
 * as taking whichever subdir answers first - would report a package that
 * migrated to `noarch` at whatever stale version its platform subdir still
 * carries, because conda channels never remove old builds.
 */
async function getChannelVersions(
  http: Http,
  { channelUrl, platforms }: Channel,
  packageName: string,
): Promise<Map<string, Release> | undefined> {
  const [noarchIndex, ...platformIndexes] = await Promise.all([
    loadIndex(http, joinUrlParts(channelUrl, noarch)),
    ...platforms.map((platform) =>
      loadIndex(http, joinUrlParts(channelUrl, platform)),
    ),
  ]);

  const noarchVersions = noarchIndex?.get(packageName);

  const platformVersions: (Map<string, Release> | undefined)[] = [];
  for (const [index, platformIndex] of platformIndexes.entries()) {
    if (!platformIndex) {
      // a subdir the channel does not publish cannot say anything about a
      // version, and treating it as empty would reject every package
      logger.once.warn(
        { channelUrl, platform: platforms[index] },
        'conda: channel publishes no index for platform, ignoring it',
      );
      continue;
    }

    platformVersions.push(platformIndex.get(packageName));
  }

  const releases = new Map<string, Release>();
  const collected = collectVersions([noarchVersions, ...platformVersions]);

  for (const [version, found] of collected) {
    // a `noarch` build works everywhere, so it satisfies every platform at once
    const installable =
      !!noarchVersions?.has(version) ||
      platformVersions.every((versions) => !!versions?.has(version));

    if (installable) {
      releases.set(version, earliestRelease(found));
    }
  }

  return releases;
}

/** Groups every build of a version found across the subdirs of a channel. */
function collectVersions(
  subdirs: (Map<string, Release> | undefined)[],
): Map<string, Release[]> {
  const collected = new Map<string, Release[]>();

  for (const versions of subdirs) {
    if (!versions) {
      continue;
    }

    for (const [version, release] of versions) {
      const found = collected.get(version);
      if (found) {
        found.push(release);
      } else {
        collected.set(version, [release]);
      }
    }
  }

  return collected;
}

/**
 * Picks the release with the earliest timestamp, which is when the version
 * first became installable from the channel on any of its platforms.
 */
function earliestRelease(found: Release[]): Release {
  let earliest = found[0];

  for (const release of found) {
    const timestamp = release.releaseTimestamp;
    if (
      timestamp &&
      (!earliest.releaseTimestamp || timestamp < earliest.releaseTimestamp)
    ) {
      earliest = release;
    }
  }

  return { ...earliest };
}

/**
 * Returns the parsed index for one subdir, or `null` when the subdir publishes
 * no index at all.
 */
async function loadIndex(
  http: Http,
  subdirUrl: string,
): Promise<RepodataIndex | null> {
  // the `datasource-mem:pkg-fetch:` prefix is what `cleanDatasourceKeys()`
  // sweeps, so a parsed index is released once lookups are done instead of
  // being held until the next repository
  const cacheKey = `datasource-mem:pkg-fetch:conda-repodata:${subdirUrl}`;
  // cache the in-flight promise so concurrent lookups in the same subdir share
  // a single download instead of each fetching the (large) index
  let index = memCache.get<Promise<RepodataIndex | null>>(cacheKey);
  if (index === undefined) {
    index = loadRepodata(http, subdirUrl).catch((err) => {
      // a cached rejection would replay the failure to every remaining
      // dependency in this subdir, so drop it and let the next one retry
      memCache.set(cacheKey, undefined);
      throw err;
    });
    memCache.set(cacheKey, index);
  }

  return await index;
}

/**
 * Conda channel indexes are large, hundreds of MB uncompressed, so we prefer
 * the zstd-compressed `repodata.json.zst` and fall back to the plain
 * `repodata.json` only when a channel does not publish the compressed variant.
 */
async function loadRepodata(
  http: Http,
  subdirUrl: string,
): Promise<RepodataIndex | null> {
  const index = await fetchIndex(http, subdirUrl);
  if (index === null) {
    logger.debug({ subdirUrl }, 'conda: channel subdir has no repodata index');
    return null;
  }

  if (!index.size) {
    logger.once.warn(
      { subdirUrl },
      'conda: repodata index contains no packages',
    );
  }

  return index;
}

/**
 * Returns the index for one subdir, or `null` when the subdir publishes neither
 * the compressed nor the plain variant.
 */
async function fetchIndex(
  http: Http,
  subdirUrl: string,
): Promise<RepodataIndex | null> {
  try {
    return await streamIndex(
      http,
      joinUrlParts(subdirUrl, 'repodata.json.zst'),
      true,
    );
  } catch (err) {
    // a host error will not be cured by asking for a different file, and
    // retrying would only mask the outage
    if (isHostError(err)) {
      throw err;
    }
    // anything else means the compressed variant is unusable here: it may be
    // absent (404), inaccessible (401/403 - S3 without `ListBucket`, or an
    // auth proxy), or served as something that is not zstd at all
    logger.debug(
      { subdirUrl, err },
      'conda: falling back to uncompressed repodata index',
    );
  }

  try {
    return await streamIndex(
      http,
      joinUrlParts(subdirUrl, 'repodata.json'),
      false,
    );
  } catch (err) {
    if (err instanceof HttpError && err.response?.statusCode === 404) {
      return null;
    }
    // both variants are unusable, so the channel cannot be read at all - say so
    // rather than letting the lookup report the subdir as simply having nothing
    logger.debug(
      { subdirUrl, err },
      'conda: could not read the repodata index for this subdir',
    );
    throw err;
  }
}

/**
 * Streams one index document straight into the parser.
 *
 * Nothing is buffered whole: an uncompressed `repodata.json` can exceed the
 * largest string V8 can hold, so reading the response into memory would fail
 * outright on the biggest channels.
 */
function streamIndex(
  http: Http,
  url: string,
  compressed: boolean,
): Promise<RepodataIndex> {
  const response = http.stream(url);

  return compressed
    ? pipeline(response, createZstdDecompress(), parseRepodataStream)
    : pipeline(response, parseRepodataStream);
}

function isHostError(err: unknown): boolean {
  if (!(err instanceof HttpError)) {
    return false;
  }

  const statusCode = err.response?.statusCode;
  if (statusCode === undefined) {
    // a transport-level failure, so the host is not answering at all
    return true;
  }

  return statusCode === 429 || statusCode >= 500;
}
