const got = require('got');
const xmlParser = require('fast-xml-parser');
const { isVersion, sortVersions } = require('../versioning/semver');
const parse = require('github-url-from-git');

module.exports = {
  getDependency,
};

async function getDependency(purl) {
  const { fullname: name } = purl;
  logger.trace(`nuget.getDependency(${name})`);
  const pkgUrl = `https://api.nuget.org/v3-flatcontainer/${name.toLowerCase()}/index.json`;
  try {
    const res = (await got(pkgUrl, {
      json: true,
      retries: 5,
    })).body;
    const dep = {
      name,
    };
    dep.releases = res.versions
      .filter(isVersion)
      .sort(sortVersions)
      .map(version => ({ version }));
    // look up nuspec for latest release to get repository
    const url = `https://api.nuget.org/v3-flatcontainer/${name.toLowerCase()}/${res.versions.pop()}/${name.toLowerCase()}.nuspec`;
    try {
      const result = await got(url);
      const nuspec = xmlParser.parse(result.body, { ignoreAttributes: false });
      if (nuspec) {
        const repositoryUrl = parse(
          nuspec.package.metadata.repository['@_url']
        );
        if (repositoryUrl) {
          dep.repositoryUrl = repositoryUrl;
        }
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ depName: name }, 'Error looking up nuspec');
    }
    logger.trace({ dep }, 'dep');
    return dep;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    logger.warn({ err, name }, 'nuget registry failure: Unknown error');
    return null;
  }
}
