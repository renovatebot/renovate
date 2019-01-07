const got = require('got');
const { coerce } = require('semver');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(purl, config = {}) {
  try {
    const { typeStrategy, digestsStrategy, serviceUrl } = config;
    let { type, digests } = config;

    if (typeStrategy !== 'auto') {
      type = typeStrategy;
    }

    if (digestsStrategy !== 'auto') {
      digests = digestsStrategy;
    }

    const response = await got(serviceUrl, {
      json: true,
    });
    const releases = await Promise.all(
      response.body
        .filter(release => !release.snapshot && !release.nightly)
        .filter(
          release =>
            // some milestone have wrong metadata and need to be filtered by version name content
            release.rcFor === '' && !release.version.includes('milestone')
        )
        .map(async release => {
          const entry = {
            version: coerce(release.version).toString(),
            downloadUrl: release.downloadUrl,
            checksumUrl: release.checksumUrl,
            digests,
          };

          if (type === 'all') {
            entry.downloadUrl = replaceType(entry.downloadUrl);
            entry.checksumUrl = replaceType(entry.checksumUrl);
          }

          if (digests === 'true') {
            const checksum = await getChecksum(entry.checksumUrl);
            if (checksum) {
              entry.checksum = checksum;
            }
          }

          return entry;
        })
    );
    const gradle = {
      releases,
      homepage: 'https://gradle.org',
      sourceUrl: 'https://github.com/gradle/gradle',
    };
    return gradle;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info('Gradle release lookup failure: not found');
      logger.debug({ err });
    } else {
      logger.warn({ err }, 'Gradle release lookup failure: Unknown error');
    }
    return null;
  }
}

function replaceType(url) {
  return url.replace('bin', 'all');
}

async function getChecksum(url) {
  try {
    const response = await got(url, {});
    return response.body;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info('Gradle checksum lookup failure: not found');
      logger.debug({ err });
    } else {
      logger.warn({ err }, 'Gradle checksum lookup failure: Unknown error');
    }
    throw err;
  }
}
