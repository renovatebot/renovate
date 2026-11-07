import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { logger } from '../../../logger/index.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import type { CachedOptions } from '../../../util/cache/package/with-cache.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { hash } from '../../../util/hash.ts';
import type { Http } from '../../../util/http/index.ts';
import type { CrateZipEntry } from './schema.ts';
import { CargoVcsInfo, CrateZipManifest } from './schema.ts';

const inflateRaw = promisify(zlib.inflateRaw);

const VCS_INFO_PATH = '.cargo_vcs_info.json';

function getCrateZipUrl(crateName: string, version: string): string {
  return `https://static.crates.io/crates/${crateName}/${crateName}-${version}.zip`;
}

/**
 * Returns the manifest entry for a file in a crates.io `.zip` archive, or
 * `undefined` if the archive does not contain that file.
 */
async function findZipEntry(
  http: Http,
  zipUrl: string,
  path: string,
): Promise<CrateZipEntry | undefined> {
  const manifestUrl = `${zipUrl}.json`;
  const { body: manifest } = await http.getJson(manifestUrl, CrateZipManifest);
  return manifest.files.find((file) => file.path === path);
}

/**
 * Downloads the compressed bytes of an entry with a range request, and
 * extracts them from the full response if the server ignores the range.
 */
async function fetchZipEntryData(
  http: Http,
  zipUrl: string,
  entry: CrateZipEntry,
): Promise<Buffer> {
  const start = entry.data_offset;
  const end = start + entry.compressed_size;
  const { statusCode, body } = await http.getBuffer(zipUrl, {
    headers: { Range: `bytes=${start}-${end - 1}` },
  });
  return Buffer.from(statusCode === 206 ? body : body.subarray(start, end));
}

/**
 * Decompresses the bytes of an entry according to its compression method.
 */
async function decompressZipEntry(
  data: Buffer,
  compression: CrateZipEntry['compression'],
): Promise<Buffer> {
  if (compression === 'deflate') {
    return await inflateRaw(data);
  }
  return data;
}

/**
 * Throws if the size or SHA-256 of the content differs from the manifest.
 */
function verifyZipEntry(content: Buffer, entry: CrateZipEntry): void {
  if (
    content.length !== entry.uncompressed_size ||
    hash(content, 'sha256') !== entry.sha256
  ) {
    throw new Error(`Integrity check failed for ${entry.path}`);
  }
}

/**
 * Returns a file from a crates.io `.zip` archive, or `null` if the archive
 * does not contain that file.
 */
async function getCrateZipEntry(
  http: Http,
  zipUrl: string,
  path: string,
): Promise<Buffer | null> {
  const entry = await findZipEntry(http, zipUrl, path);
  if (!entry) {
    return null;
  }

  const data = await fetchZipEntryData(http, zipUrl, entry);
  const content = await decompressZipEntry(data, entry.compression);
  verifyZipEntry(content, entry);
  return content;
}

/**
 * Returns `path_in_vcs` from the `.cargo_vcs_info.json` file of a crates.io
 * crate version, or `null` if it cannot be determined.
 */
export function getPathInVcs(
  http: Http,
  crateName: string,
  version: string,
): Promise<string | null> {
  const cacheOptions: CachedOptions = {
    namespace: 'datasource-crate-vcs-info',
    key: buildCacheKey(crateName, version),
    ttlMinutes: 30 * 24 * 60,
    public: true,
  };
  return withCache(cacheOptions, async (ctx) => {
    try {
      const zipUrl = getCrateZipUrl(crateName, version);
      const vcsInfo = await getCrateZipEntry(http, zipUrl, VCS_INFO_PATH);
      if (!vcsInfo) {
        return null;
      }
      return CargoVcsInfo.parse(vcsInfo.toString()).path_in_vcs;
    } catch (err) {
      logger.debug(
        { err, crateName, version },
        'Failed to read .cargo_vcs_info.json',
      );
      ctx.cacheable = false;
      return null;
    }
  });
}
