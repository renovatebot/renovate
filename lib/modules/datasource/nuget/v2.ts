import { XmlDocument, XmlElement } from 'xmldoc';
import { logger } from '../../../logger';
import type { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import type { ReleaseResult } from '../types';
import { massageUrl, removeBuildMeta } from './common';

export class NugetV2Api {
  getPkgProp(pkgInfo: XmlElement, propName: string): string | undefined {
    return pkgInfo.childNamed('m:properties')?.childNamed(`d:${propName}`)?.val;
  }

  async getReleases(
    http: Http,
    feedUrl: string,
    pkgName: string,
  ): Promise<ReleaseResult | null> {
    const dep: ReleaseResult = {
      releases: [],
    };
    let pkgUrlList: string | null = `${feedUrl.replace(
      regEx(/\/+$/),
      '',
    )}/FindPackagesById()?id=%27${pkgName}%27&$select=Version,IsLatestVersion,ProjectUrl,Published`;
    while (pkgUrlList !== null) {
      // typescript issue
      const pkgVersionsListRaw = await http.get(pkgUrlList);
      const pkgVersionsListDoc = new XmlDocument(pkgVersionsListRaw.body);

      const pkgInfoList = pkgVersionsListDoc.childrenNamed('entry');

      for (const pkgInfo of pkgInfoList) {
        const version = this.getPkgProp(pkgInfo, 'Version');
        const releaseTimestamp = this.getPkgProp(pkgInfo, 'Published');
        dep.releases.push({
          // TODO: types (#22198)
          version: removeBuildMeta(`${version}`),
          releaseTimestamp,
        });
        try {
          const pkgIsLatestVersion = this.getPkgProp(
            pkgInfo,
            'IsLatestVersion',
          );
          if (pkgIsLatestVersion === 'true') {
            dep['tags'] = { latest: removeBuildMeta(`${version}`) };
            const projectUrl = this.getPkgProp(pkgInfo, 'ProjectUrl');
            if (projectUrl) {
              dep.sourceUrl = massageUrl(projectUrl);
            }
          }
        } catch (err) /* istanbul ignore next */ {
          logger.debug(
            { err, pkgName, feedUrl },
            `nuget registry failure: can't parse pkg info for project url`,
          );
        }
      }

      const nextPkgUrlListLink = pkgVersionsListDoc
        .childrenNamed('link')
        .find((node) => node.attr.rel === 'next');

      pkgUrlList = nextPkgUrlListLink ? nextPkgUrlListLink.attr.href : null;
    }

    // dep not found if no release, so we can try next registry
    if (dep.releases.length === 0) {
      return null;
    }

    return dep;
  }
}
