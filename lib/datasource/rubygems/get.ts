import { OutgoingHttpHeaders } from 'http';
import urlJoin from 'url-join';
import { logger } from '../../logger';
import { Http } from '../../util/http';
import { ReleaseResult } from '../common';
import { id } from './common';

const http = new Http(id);

const INFO_PATH = '/api/v1/gems';
const VERSIONS_PATH = '/api/v1/versions';

const getHeaders = (): OutgoingHttpHeaders => {
  return { hostType: id };
};

export async function fetch(
  dependency: string,
  registry: string,
  path: string
): Promise<any> {
  const headers = getHeaders();

  const url = urlJoin(registry, path, `${dependency}.json`);

  logger.trace({ dependency }, `RubyGems lookup request: ${url}`);
  const response = (await http.getJson(url, { headers })) || {
    body: undefined,
  };

  return response.body;
}

export async function getDependency(
  dependency: string,
  registry: string
): Promise<ReleaseResult | null> {
  logger.debug({ dependency }, 'RubyGems lookup for dependency');
  const info = await fetch(dependency, registry, INFO_PATH);
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

  const versions = (await fetch(dependency, registry, VERSIONS_PATH)) || [];

  let releases = versions.map(
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

  if (versions.length === 0 && info.version) {
    logger.warn('falling back to using the info version');
    releases = [
      {
        version: info.version,
        rubyPlatform: info.platform,
        releaseTimestamp: null,
        rubyVersion: null,
        rubygemsVersion: '\u003e= 0',
      },
    ];
  }

  return {
    releases,
    homepage: info.homepage_uri,
    sourceUrl: info.source_code_uri,
    changelogUrl: info.changelog_uri,
  };
}
