import parse from 'github-url-from-git';
import { XmlDocument, XmlElement } from 'xmldoc';
import { logger } from '../../logger';
import got from '../../util/got';
import { ReleaseResult } from '../common';

export async function getPkgReleases(
  feedUrl: string,
  pkgName: string
): Promise<ReleaseResult | null> {
  const dep: ReleaseResult = {
    pkgName,
    releases: null,
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

      const pkgInfoList = pkgVersionsListDoc.childrenNamed('entry');

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

      const nextPkgUrlListLink = pkgVersionsListDoc
        .childrenNamed('link')
        .find(node => node.attr.rel === 'next');

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

function getPkgProp(pkgInfo: XmlElement, propName: string) {
  return pkgInfo.childNamed('m:properties').childNamed(`d:${propName}`).val;
}
