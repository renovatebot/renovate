import Marshal from 'marshal';
import urlJoin from 'url-join';
import { logger } from '../../logger';
import { getQueryString } from '../../util/url';
import type { ReleaseResult } from '../types';
import { http } from './common';
import type { MarshalledVersionInfo } from './types';

const DEPENDENCIES_PATH = '/api/v1/dependencies';

export async function fetch(
  dependency: string,
  registry: string
): Promise<MarshalledVersionInfo[]> {
  const url = urlJoin(
    registry,
    DEPENDENCIES_PATH,
    '?' +
      getQueryString({
        gems: dependency,
      })
  );

  logger.trace({ dependency }, `RubyGems lookup request: ${String(url)}`);
  const response = await http.getBuffer(url);

  return new Marshal(response.body).parsed as MarshalledVersionInfo[];
}

export async function getGitHubPackagesDependency(
  dependency: string,
  registry: string
): Promise<ReleaseResult | null> {
  logger.debug(
    { dependency },
    'RubyGems lookup for dependency (GitHub Packages)'
  );
  const info = await fetch(dependency, registry);
  if (!info || info.length === 0) {
    return null;
  }
  const releases = info.map(({ number: version, platform: rubyPlatform }) => ({
    version,
    rubyPlatform,
  }));
  return {
    releases,
    homepage: null,
    sourceUrl: null,
    changelogUrl: null,
  };
}
