import { logger } from '../../logger';
import { HttpError } from '../../util/http/types';
import type { Release, ReleaseResult } from '../types';
import { fetchBuffer, fetchJson } from './common';
import type {
  JsonGemVersions,
  JsonGemsInfo,
  MarshalledVersionInfo,
} from './types';

const INFO_PATH = '/api/v1/gems';
const VERSIONS_PATH = '/api/v1/versions';
const DEPENDENCIES_PATH = '/api/v1/dependencies';

export async function getDependencyFallback(
  dependency: string,
  registry: string
): Promise<ReleaseResult | null> {
  logger.debug(
    { dependency, api: DEPENDENCIES_PATH },
    'RubyGems lookup for dependency'
  );
  const info = await fetchBuffer<MarshalledVersionInfo[]>(
    dependency,
    registry,
    DEPENDENCIES_PATH
  );
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

export async function getDependency(
  dependency: string,
  registry: string
): Promise<ReleaseResult | null> {
  logger.debug(
    { dependency, api: INFO_PATH },
    'RubyGems lookup for dependency'
  );
  let info: JsonGemsInfo;

  try {
    info = await fetchJson(dependency, registry, INFO_PATH);
  } catch (error) {
    // fallback to deps api on 404
    if (error instanceof HttpError && error.response?.statusCode === 404) {
      return await getDependencyFallback(dependency, registry);
    }
    throw error;
  }

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
    versions = await fetchJson(dependency, registry, VERSIONS_PATH);
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

  // TODO: invalid properties for `Release` see #11312

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
