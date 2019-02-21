const parse = require('github-url-from-git');
const { XmlDocument } = require('xmldoc');
const get = require('./get');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(feedUrl, pkgName) {
  const pkgUrlList = `${feedUrl}/FindPackagesById()?id=%27${pkgName}%27&$select=Version,IsLatestVersion`;
  const dep = {
    pkgName,
  };
  try {
    const pkgVersionsListRaw = await get(pkgUrlList, { retry: 5 });
    if (pkgVersionsListRaw.statusCode !== 200) {
      logger.debug(
        { dependency: pkgName, pkgVersionsListRaw },
        `nuget registry failure: status code != 200`
      );
      return null;
    }
    const pkgInfoList = new XmlDocument(
      pkgVersionsListRaw.body
    ).children.filter(node => node.name === 'entry');

    dep.releases = [];

    for (const pkgInfo of pkgInfoList || []) {
      const pkgVersion = getPkgProp(pkgInfo, 'Version');
      dep.releases.push({
        version: pkgVersion,
      });
      try {
        const pkgIsLatestVersion = getPkgProp(pkgInfo, 'IsLatestVersion');
        if (pkgIsLatestVersion === 'true') {
          dep.sourceUrl = parse(getPkgProp(pkgInfo, 'ProjectUrl'));
        }
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { err, pkgName, feedUrl },
          `nuget registry failure: can't parse pkg info for project url`
        );
      }
    }

    return dep;
  } catch (err) {
    logger.debug(
      { err, pkgName, feedUrl },
      'nuget registry failure: Unknown error'
    );
    return null;
  }
}

function getPkgProp(pkgInfo, propName) {
  return pkgInfo.children
    .find(child => child.name === 'm:properties')
    .children.find(child => child.name === `d:${propName}`).val;
}
