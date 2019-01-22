const got = require('got');
const { coerce } = require('semver');

module.exports = {
  getPkgReleases,
};

const GradleVersionsServiceUrl = 'https://services.gradle.org/versions/all';

async function getPkgReleases() {
  try {
    const response = await got(GradleVersionsServiceUrl, {
      json: true,
    });
    const releases = response.body
      .filter(release => !release.snapshot && !release.nightly)
      .filter(
        release =>
          // some milestone have wrong metadata and need to be filtered by version name content
          release.rcFor === '' && !release.version.includes('milestone')
      )
      .map(release => ({
        version: coerce(release.version).toString(),
        downloadUrl: release.downloadUrl,
        checksumUrl: release.checksumUrl,
      }));
    const gradle = {
      releases,
      homepage: 'https://gradle.org',
      sourceUrl: 'https://github.com/gradle/gradle',
    };
    return gradle;
  } catch (err) {
    logger.debug({ err });
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      throw new Error('registry-failure');
    }
    logger.warn({ err }, 'Gradle release lookup failure: Unknown error');
    return null;
  }
}
