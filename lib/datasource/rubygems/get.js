const URL = require('url');
const got = require('got');
const { maskToken } = require('../../util/mask');
const hostRules = require('../../util/host-rules');
const retriable = require('./retriable');
const { UNAUTHORIZED, FORBIDDEN, NOT_FOUND } = require('./errors');

const INFO_PATH = '/api/v1/gems';
const VERSIONS_PATH = '/api/v1/versions';

// istanbul ignore next
const processError = ({ err, ...rest }) => {
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
      throw new Error('registry-failure');
  }
};

const getHeaders = url => {
  const { host } = URL.parse(url.toString());
  const { token } = hostRules.find({ host, platform: 'rubygems' }) || {};

  return token ? { Authorization: token } : {};
};

const fetch = async ({ dependency, registry, path }) => {
  const json = true;

  const retry = retriable();
  const headers = getHeaders(registry);

  const name = `/${dependency}.json`;
  const baseUrl = `${registry}/${path}`;

  const response = (await got(name, { retry, json, baseUrl, headers })) || {};

  return response.body;
};

const getDependency = async ({ dependency, registry }) => {
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
        created_at: releaseDate,
        rubygems_version: rubygemsVersion,
        ruby_version: rubyVersion,
      }) => ({
        version,
        rubyPlatform,
        releaseDate,
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

module.exports = {
  getDependency,
};
