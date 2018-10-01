const got = require('got');
const github = require('./github');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(purl, config) {
  const { fullname: name } = purl;
  logger.trace(`go.getPkgReleases(${name})`);
  const pkgUrl = 'https://' + name;
  try {
    const res = (await got(pkgUrl, {
      retries: 5,
    })).body;
    const sourceMatch = res.match(
      new RegExp(`<meta name="go-source" content="${name}\\s+([^\\s]+)`)
    );
    if (sourceMatch) {
      const [, sourceUrl] = sourceMatch;
      logger.debug({ name, sourceUrl }, 'Go lookup sourceUrl');
      if (sourceUrl && sourceUrl.startsWith('https://github.com/')) {
        const githubPurl = {
          fullname: sourceUrl
            .replace('https://github.com/', '')
            .replace(/\/$/, ''),
          qualifiers: {},
        };
        const githubTags = await github.getPkgReleases(githubPurl, config);
        return githubTags;
      }
      logger.info('Unknown go source: ' + sourceUrl);
    } else {
      logger.trace({ depName: name }, 'No go-source header found');
    }
    return null;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ dependency: name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    logger.info({ err, name }, 'go lookup failure: Unknown error');
    return null;
  }
}
