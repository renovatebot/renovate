import { XmlDocument, XmlElement } from 'xmldoc';
import { logger } from '../../logger';
import { Http } from '../../util/http';
import type { ReleaseResult } from '../types';

import { id, removeBuildMeta } from './common';

const http = new Http(id);

function getPkgProp(pkgInfo: XmlElement, propName: string): string {
  return pkgInfo.childNamed('m:properties').childNamed(`d:${propName}`)?.val;
}

export async function getReleases(
  feedUrl: string,
  pkgName: string
): Promise<ReleaseResult | null> {
  const dep: ReleaseResult = {
    releases: [],
  };
  let pkgUrlList = `${feedUrl.replace(
    /\/+$/,
    ''
  )}/FindPackagesById()?id=%27${pkgName}%27&$select=Version,IsLatestVersion,ProjectUrl,Published`;
  do {
    const pkgVersionsListRaw = await http.get(pkgUrlList);
    const pkgVersionsListDoc = new XmlDocument(pkgVersionsListRaw.body);

    const pkgInfoList = pkgVersionsListDoc.childrenNamed('entry');

    for (const pkgInfo of pkgInfoList) {
      const version = getPkgProp(pkgInfo, 'Version');
      const releaseTimestamp = getPkgProp(pkgInfo, 'Published');
      dep.releases.push({
        version: removeBuildMeta(version),
        releaseTimestamp,
      });
      try {
        const pkgIsLatestVersion = getPkgProp(pkgInfo, 'IsLatestVersion');
        if (pkgIsLatestVersion === 'true') {
          const projectUrl = getPkgProp(pkgInfo, 'ProjectUrl');
          if (projectUrl) {
            dep.sourceUrl = projectUrl;
          }
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
      .find((node) => node.attr.rel === 'next');

    pkgUrlList = nextPkgUrlListLink ? nextPkgUrlListLink.attr.href : null;
  } while (pkgUrlList !== null);

  // dep not found if no release, so we can try next registry
  if (dep.releases.length === 0) {
    return null;
  }

  return dep;
}
