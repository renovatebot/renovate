const parse = require('github-url-from-git');
const { XmlDocument } = require('xmldoc');
const { logger } = require('../../logger');
const got = require('../../util/got');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(feedUrl, pkgName) {
  const dep = {
    pkgName,
  };
  try {
    dep.releases = [];

    let pkgUrlList = `${feedUrl}/FindPackagesById()?id=%27${pkgName}%27&$select=Version,IsLatestVersion,ProjectUrl`;
    do {
      const pkgVersionsListRaw = await got(pkgUrlList, { hostType: 'nuget' });
      if (pkgVersionsListRaw.statusCode !== 200) {
        logger.debug(
          { dependency: pkgName, pkgVersionsListRaw },
          `nuget registry failure: status code != 200`
        );
        return null;
      }

      const pkgVersionsListDoc = new XmlDocument(pkgVersionsListRaw.body);

      const pkgInfoList = pkgVersionsListDoc.children.filter(
        // @ts-ignore
        node => node.name === 'entry'
      );

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

      const nextPkgUrlListLink = pkgVersionsListDoc.children.find(
        // @ts-ignore
        node => node.name === 'link' && node.attr.rel === 'next'
      );

      // @ts-ignore
      pkgUrlList = nextPkgUrlListLink ? nextPkgUrlListLink.attr.href : null;
    } while (pkgUrlList !== null);

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
