const addrs = require('email-addresses');
const Git = require('simple-git/promise');

module.exports = {
  setMeta,
  setGitPrivateKey,
};

function setMeta(config) {
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
  }
}
async function setGitPrivateKey(config) {
  if (config.gitPrivateKey && config.localDir) {
    try {
      const cwd = config.localDir;
      const git = Git(cwd).silent(true);
      await git.raw([
        'config',
        '--global',
        'user.signingkey',
        config.gitPrivateKey,
      ]);
    } catch (err) {
      logger.warn({ err }, 'Error in setting git private key to author');
    }
  }
}
