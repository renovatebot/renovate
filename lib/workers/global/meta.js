const addrs = require('email-addresses');

module.exports = {
  setMeta,
};

function setMeta(config) {
  const { gitAuthor } = config;
  if (gitAuthor) {
    let gitAuthorParsed;
    try {
      gitAuthorParsed = addrs.parseOneAddress(gitAuthor);
    } catch (err) /* istanbul ignore next */ {
      logger.debug(
        { gitAuthor: config.gitAuthor, err },
        'Error parsing gitAuthor'
      );
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
  }
}
