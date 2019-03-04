const { coerce } = require('semver');
const got = require('../../util/got');
const hostRules = require('../../util/host-rules');

module.exports = {
  getPkgReleases,
};

const GradleVersionsServiceUrl = 'https://services.gradle.org/versions/all';

async function getPkgReleases() {
  let options = { json: true };
  const hostRule = hostRules.find({
    platform: 'gradle',
    endpoint: GradleVersionsServiceUrl,
  });
  if (hostRule && hostRule.username && hostRule.password) {
    const auth = Buffer.from(
      `${hostRule.username}:${hostRule.password}`
    ).toString('base64');
    options = {
      ...options,
      headers: {
        Authorization: `Basic ${auth}`,
      },
    };

    logger.debug(
      { GradleVersionsServiceUrl },
      `Setting basic auth header as configured via host rule`
    );
  }
  try {
    const response = await got(GradleVersionsServiceUrl, options);
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
