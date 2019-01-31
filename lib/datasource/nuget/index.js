const parse = require('github-url-from-git');
const got = require('got');
const { XmlDocument } = require('xmldoc');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases({ lookupName }) {
  logger.trace(`nuget.getPkgReleases(${lookupName})`);
  const pkgUrl = `https://api.nuget.org/v3-flatcontainer/${lookupName.toLowerCase()}/index.json`;
  try {
    const res = (await got(pkgUrl, {
      json: true,
      retry: 5,
    })).body;
    const dep = {
      name: lookupName,
    };
    dep.releases = (res.versions || []).map(version => ({ version }));
    // look up nuspec for latest release to get repository
    const url = `https://api.nuget.org/v3-flatcontainer/${lookupName.toLowerCase()}/${res.versions.pop()}/${lookupName.toLowerCase()}.nuspec`;
    try {
      const result = await got(url);
      const nuspec = new XmlDocument(result.body);
      if (nuspec) {
        const sourceUrl = parse(
          nuspec.valueWithPath('metadata.repository@url')
        );
        if (sourceUrl) {
          dep.sourceUrl = sourceUrl;
        }
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ lookupName }, 'Error looking up nuspec');
    }
    logger.trace({ dep }, 'dep');
    return dep;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ lookupName }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    logger.warn({ err, lookupName }, 'nuget registry failure: Unknown error');
    return null;
  }
}
