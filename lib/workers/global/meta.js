const addrs = require('email-addresses');
const { getPlatformApi } = require('../../platform');
const hostRules = require('../../util/host-rules');

module.exports = {
  setMeta,
};

async function setMeta(config) {
  const { gitAuthor } = config;
  if (gitAuthor) {
    let gitAuthorParsed;
    try {
      gitAuthorParsed = addrs.parseOneAddress(gitAuthor);
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ gitAuthor, err }, 'Error parsing gitAuthor');
    }
    // istanbul ignore if
    if (!gitAuthorParsed) {
      throw new Error(
        'Configured gitAuthor is not parsed as valid RFC5322 format'
      );
    }
    global.gitAuthor = {
      name: gitAuthorParsed.name,
      email: gitAuthorParsed.address,
    };
  } else {
    const credentials = hostRules.find(config, {});
    let gitAuthorFromApi;
    try {
      gitAuthorFromApi = await getPlatformApi(config.platform).getAuthor(
        credentials.token,
        credentials.endpoint
      );
    } catch (err) {
      logger.debug('Error getting gitAuthor from api');
    }
    if (gitAuthorFromApi && gitAuthorFromApi.name && gitAuthorFromApi.email) {
      global.gitAuthor = {
        name: gitAuthorFromApi.name,
        email: gitAuthorFromApi.email,
      };
    }
  }
}
