import { OutgoingHttpHeaders } from 'http';
import { RetryOptions } from 'got/dist/source';
import { logger } from '../../logger';
import got, { GotHeaders } from '../../util/got';
import { maskToken } from '../../util/mask';
import retriable from './retriable';
import { UNAUTHORIZED, FORBIDDEN, NOT_FOUND } from './errors';
import { ReleaseResult } from '../common';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';
import { DATASOURCE_RUBYGEMS } from '../../constants/data-binary-source';

const INFO_PATH = '/api/v1/gems';
const VERSIONS_PATH = '/api/v1/versions';

// istanbul ignore next
const processError = ({ err, ...rest }): null => {
  const { statusCode, headers = {} } = err;
  const data = {
    ...rest,
    err,
    statusCode,
    token: maskToken(headers.authorization) || 'none',
  };

  switch (statusCode) {
    case NOT_FOUND:
      logger.info(data, 'RubyGems lookup failure: not found');
      break;
    case FORBIDDEN:
    case UNAUTHORIZED:
      logger.info(data, 'RubyGems lookup failure: authentication failed');
      break;
    default:
      logger.debug(data, 'RubyGems lookup failure');
      throw new Error(DATASOURCE_FAILURE);
  }
  return null;
};

const getHeaders = (): OutgoingHttpHeaders => {
  return { hostType: DATASOURCE_RUBYGEMS };
};

const fetch = async ({ dependency, registry, path }): Promise<any> => {
  const responseType = 'json';

  const retry: RetryOptions = { calculateDelay: retriable() };
  const headers: GotHeaders = getHeaders();

  const name = `${path}/${dependency}.json`;
  const baseUrl = registry;

  logger.trace({ dependency }, `RubyGems lookup request: ${baseUrl} ${name}`);
  const response = (await got(name, {
    retry,
    responseType,
    prefixUrl: baseUrl,
    headers,
  })) || {
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
