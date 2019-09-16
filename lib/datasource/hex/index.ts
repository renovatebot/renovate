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
}: Partial<PkgReleaseConfig>): Promise<ReleaseResult | null> {
  // istanbul ignore if
  if (!lookupName) {
    logger.warn('hex lookup failure: No lookupName');
    return null;
  }

  // Get dependency name from lookupName.
  // If the dependency is private lookupName contains organization name as following:
  // depName:organizationName
  // depName is used to pass it in hex dep url
  // organizationName is used for accessing to private deps
  const depName = lookupName.split(':')[0];
  const hexUrl = `https://hex.pm/api/packages/${depName}`;
  try {
    const opts = getHostOpts();
    const res: HexRelease = (await got(hexUrl, {
      json: true,
      ...opts,
    })).body;
    if (!(res && res.releases && res.name)) {
      logger.warn({ depName }, `Received invalid hex package data`);
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
      logger.info({ depName }, `Authorization failure: not authorized`);
      logger.debug(
        {
          err,
        },
        'Authorization error'
      );
      return null;
    }
    if (err.statusCode === 404) {
      logger.info({ depName }, `Dependency lookup failure: not found`);
      logger.debug(
        {
          err,
        },
        'Package lookup error'
      );
      return null;
    }
    logger.warn({ err, depName }, 'hex lookup failure: Unknown error');
    return null;
  }
}
