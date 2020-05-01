import { OutgoingHttpHeaders } from 'http';
import { logger } from '../../logger';
import { Http } from '../../util/http';
import { maskToken } from '../../util/mask';
import { ReleaseResult } from '../common';
import { id } from './common';
import { FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from './errors';

const http = new Http(id);

const INFO_PATH = '/api/v1/gems';
const VERSIONS_PATH = '/api/v1/versions';

// istanbul ignore next
const processError = ({ err, ...rest }): null => {
  const { code, statusCode, headers = {} } = err;
  const data = {
    ...rest,
    err,
    statusCode,
    token: maskToken(headers.authorization) || 'none',
  };

  if (code === 'ENOTFOUND' || statusCode === NOT_FOUND) {
    logger.debug(data, 'RubyGems lookup failure: not found');
  } else if (statusCode === FORBIDDEN || statusCode === UNAUTHORIZED) {
    logger.debug(data, 'RubyGems lookup failure: authentication failed');
  } else {
    logger.debug(data, 'RubyGems lookup failure: unknown reason');
  }
  return null;
};

const getHeaders = (): OutgoingHttpHeaders => {
  return { hostType: id };
};

const fetch = async ({ dependency, registry, path }): Promise<any> => {
  const headers = getHeaders();

  const name = `${path}/${dependency}.json`;
  const baseUrl = registry;

  logger.trace({ dependency }, `RubyGems lookup request: ${baseUrl} ${name}`);
  const response = (await http.getJson(name, { baseUrl, headers })) || {
    body: undefined,
  };

  return response.body;
};

export const getDependency = async ({
  dependency,
  registry,
}): Promise<ReleaseResult | null> => {
  logger.debug({ dependency }, 'RubyGems lookup for dependency');
  try {
    const info = await fetch({ dependency, registry, path: INFO_PATH });
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

    const versions =
      (await fetch({ dependency, registry, path: VERSIONS_PATH })) || [];

    const releases = versions.map(
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

    return {
      releases,
      homepage: info.homepage_uri,
      sourceUrl: info.source_code_uri,
      changelogUrl: info.changelog_uri,
    };
  } catch (err) {
    return processError({ err, registry, dependency });
  }
};
