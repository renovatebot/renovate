import { gunzip } from 'node:zlib';
import { promisify } from 'util';
import { logger } from '../../../../logger/index.ts';
import type { Http } from '../../../../util/http/index.ts';
import type { ReleaseResult } from '../../types.ts';

const gunzipAsync = promisify(gunzip);

type RpmVersionValue = boolean | number | string | null | undefined;

export function formatRpmVersion(
  ver: RpmVersionValue,
  rel?: RpmVersionValue,
): string | null {
  if (ver === undefined || ver === null) {
    return null;
  }

  const version = String(ver);

  if (rel === undefined || rel === null) {
    return version;
  }

  return `${version}-${String(rel)}`;
}

export function buildReleaseResult(
  versions: Iterable<string>,
): ReleaseResult | null {
  const uniqueVersions = [...new Set(versions)];

  if (uniqueVersions.length === 0) {
    return null;
  }

  return {
    releases: uniqueVersions.map((version) => ({ version })),
  };
}

export async function getGunzippedBuffer(
  http: Http,
  url: string,
): Promise<Buffer> {
  try {
    const response = await http.getBuffer(url);
    if (response.body.length === 0) {
      logger.debug(`Empty response body from getting ${url}.`);
      throw new Error(`Empty response body from getting ${url}.`);
    }

    return await gunzipAsync(response.body);
  } catch (err) {
    logger.debug(
      `Failed to fetch or decompress ${url}: ${
        err instanceof Error ? err.message : err
      }`,
    );
    throw err;
  }
}
