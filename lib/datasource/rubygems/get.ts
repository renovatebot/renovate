import * as Marshal from '@qnighy/marshal';
import urlJoin from 'url-join';
import { logger } from '../../logger';
import { Http } from '../../util/http';
import type { OutgoingHttpHeaders } from '../../util/http/types';
import { getQueryString } from '../../util/url';
import type { ReleaseResult } from '../types';
import { id } from './common';
import type { MarshalledVersionInfo } from './types';

const http = new Http(id);

const INFO_PATH = '/api/v1/gems';
const VERSIONS_PATH = '/api/v1/versions';
const DEPENDENCIES_PATH = '/api/v1/dependencies';

const getHeaders = (): OutgoingHttpHeaders => ({ hostType: id });

export async function fetch(
  dependency: string,
  registry: string,
  path: string
): Promise<any> {
  const headers = getHeaders();

  const url = urlJoin(registry, path, `${dependency}.json`);

  logger.trace({ dependency }, `RubyGems lookup request: ${String(url)}`);
  const response = (await http.getJson(url, { headers })) || {
    body: undefined,
  };

  return response.body;
}

export async function fetchDependencies(
  dependencies: string[],
  registry: string
): Promise<MarshalledVersionInfo[]> {
  const headers = getHeaders();

  const url = urlJoin(
    registry,
    DEPENDENCIES_PATH,
    '?' +
      getQueryString({
        gems: dependencies.join(','),
      })
  );

  logger.trace({ dependencies }, `RubyGems lookup request: ${String(url)}`);
  const response = await http.getBuffer(url, { headers });

  logger.debug({ response }, 'dependencies response');
  if (!response || !response.body) {
    return null;
  }

  return Marshal.parse(response.body) as MarshalledVersionInfo[];
}

async function getDependencyFromV1Dependencies(
  dependency: string,
  registry: string
): Promise<ReleaseResult | null> {
  logger.debug({ dependency }, 'falling back to dependencies endpoint');
  let depInfo: MarshalledVersionInfo[] | null = null;
  try {
    depInfo = await fetchDependencies([dependency], registry);
  } catch (err) {
    // Ignore error because this endpoint is just a fallback
    logger.debug({ registry, err }, 'dependencies endpoint returns error');
  }
  if (!depInfo) {
    return null;
  }
  const releases = depInfo.map(
    ({ number: version, platform: rubyPlatform }) => ({
      version,
      rubyPlatform,
    })
  );
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
  logger.debug({ dependency }, 'RubyGems lookup for dependency');
  let info = null;
  try {
    info = await fetch(dependency, registry, INFO_PATH);
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) {
      logger.debug(
        { registry },
        'info endpoint returns error - falling back to dependencies endpoint'
      );
      const result = await getDependencyFromV1Dependencies(
        dependency,
        registry
      );
      if (result) {
        return result;
      }
    }
    throw err;
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

  let versions = [];
  let releases = [];
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

  if (versions.length === 0 && info.version) {
    logger.warn('falling back to the version from the info endpoint');
    releases = [
      {
        version: info.version,
        rubyPlatform: info.platform,
      },
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
