const got = require('got');
const { coerce } = require('semver');

module.exports = {
  getPkgReleases,
};

const GradleVersionsServiceUrl = 'https://services.gradle.org/versions/all';

async function getPkgReleases(purl, config = {}) {
  try {
    const response = await got(GradleVersionsServiceUrl, {
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
          };

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
