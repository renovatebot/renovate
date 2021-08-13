import urlJoin from 'url-join';
import { logger } from '../../logger';
import type { Release, ReleaseResult } from '../types';
import { http } from './common';
import type { JsonGemVersions, JsonGemsInfo } from './types';

const INFO_PATH = '/api/v1/gems';
const VERSIONS_PATH = '/api/v1/versions';

export async function fetch<T>(
  dependency: string,
  registry: string,
  path: string
): Promise<T> {
  const url = urlJoin(registry, path, `${dependency}.json`);

  logger.trace({ dependency }, `RubyGems lookup request: ${String(url)}`);
  const response = (await http.getJson<T>(url)) || {
    body: undefined,
  };

  return response.body;
}

export async function getDependency(
  dependency: string,
  registry: string
): Promise<ReleaseResult | null> {
  logger.debug({ dependency }, 'RubyGems lookup for dependency');
  const info = await fetch<JsonGemsInfo>(dependency, registry, INFO_PATH);

  if (!info) {
    logger.debug({ dependency }, 'RubyGems package not found.');
    return null;
  }

  if (dependency.toLowerCase() !== info.name.toLowerCase()) {
    logger.warn(
      { lookup: dependency, returned: info.name },
      'Lookup name does not match with returned.'
    );
    return null;
  }

  let versions: JsonGemVersions[] = [];
  let releases: Release[] = [];
  try {
    versions = await fetch(dependency, registry, VERSIONS_PATH);
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      logger.debug(
        { registry },
        'versions endpoint returns error - falling back to info endpoint'
      );
    } else {
      throw err;
    }
  }

  // FIXME: invalid properties for `Release`

  if (versions.length === 0 && info.version) {
    logger.warn('falling back to the version from the info endpoint');
    releases = [
      {
        version: info.version,
        rubyPlatform: info.platform,
      } as Release,
    ];
  } else {
    releases = versions.map(
      ({
        number: version,
        platform: rubyPlatform,
        created_at: releaseTimestamp,
        rubygems_version: rubygemsVersion,
        ruby_version: rubyVersion,
      }) => ({
        version,
        rubyPlatform,
        releaseTimestamp,
        rubygemsVersion,
        rubyVersion,
      })
    );
  }

  return {
    releases,
    homepage: info.homepage_uri,
    sourceUrl: info.source_code_uri,
    changelogUrl: info.changelog_uri,
  };
}
