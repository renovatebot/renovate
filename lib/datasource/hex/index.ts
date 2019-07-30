import { logger } from '../../logger';
import got from '../../util/got';
import { ReleaseResult, PkgReleaseConfig } from '../common';

function getHostOpts() {
  return {
    json: true,
    hostType: 'hex',
  };
}

interface HexRelease {
  html_url: string;
  meta?: { links?: Record<string, string> };
  name?: string;
  releases?: { version: string }[];
}

export async function getPkgReleases({
  lookupName,
}: Partial<PkgReleaseConfig>): Promise<ReleaseResult> {
  const hexUrl = `https://hex.pm/api/packages/${lookupName}`;
  try {
    const opts = getHostOpts();
    const res: HexRelease = (await got(hexUrl, {
      json: true,
      ...opts,
    })).body;
    if (!(res && res.releases && res.name)) {
      logger.warn({ lookupName }, `Received invalid hex package data`);
      return null;
    }
    const result: ReleaseResult = {
      releases: [],
    };
    if (res.releases) {
      result.releases = res.releases.map(version => ({
        version: version.version,
      }));
    }
    if (res.meta && res.meta.links) {
      result.sourceUrl = res.meta.links.Github;
    }
    result.homepage = res.html_url;
    return result;
  } catch (err) {
    if (err.statusCode === 401) {
      logger.info({ lookupName }, `Authorization failure: not authorized`);
      logger.debug(
        {
          err,
        },
        'Authorization error'
      );
      return null;
    }
    if (err.statusCode === 404) {
      logger.info({ lookupName }, `Dependency lookup failure: not found`);
      logger.debug(
        {
          err,
        },
        'Package lookup error'
      );
      return null;
    }
    logger.warn({ err, lookupName }, 'hex lookup failure: Unknown error');
    return null;
  }
}
