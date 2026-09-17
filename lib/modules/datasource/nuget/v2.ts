import type { XmlElement } from 'xmldoc';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger/index.ts';
import type { Http } from '../../../util/http/index.ts';
import { regEx } from '../../../util/regex.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import type { ReleaseResult } from '../types.ts';
import { resolvePaginationUrl } from '../util.ts';
import { massageUrl, removeBuildMeta } from './common.ts';

export class NugetV2Api {
  getPkgProp(pkgInfo: XmlElement, propName: string): string | undefined {
    return pkgInfo.childNamed('m:properties')?.childNamed(`d:${propName}`)?.val;
  }

  async getReleases(
    http: Http,
    feedUrl: string,
    pkgName: string,
    allowCrossOrigin: boolean,
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
      const pkgVersionsListRaw = await http.getText(pkgUrlList);
      const pkgVersionsListDoc = new XmlDocument(pkgVersionsListRaw.body);

      const pkgInfoList = pkgVersionsListDoc.childrenNamed('entry');

      for (const pkgInfo of pkgInfoList) {
        const version = this.getPkgProp(pkgInfo, 'Version');
        const releaseTimestamp = asTimestamp(
          this.getPkgProp(pkgInfo, 'Published'),
        );
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
            dep.tags = { latest: removeBuildMeta(`${version}`) };
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

      // Resolve the relative-or-absolute next link, but only follow it when it stays on the same origin, or if the user has opted in via `RENOVATE_X_NUGET_PAGINATION_ALLOW_CROSS_ORIGIN`
      const nextHref = nextPkgUrlListLink?.attr.href;
      const nextUrl: string | null = nextHref
        ? resolvePaginationUrl(pkgUrlList, nextHref, allowCrossOrigin)
        : null;
      if (nextHref && !nextUrl) {
        // make sure that users are aware if there are any (potentially malicious, or misconfigured) pagination links being returned
        logger.once.warn(
          { feedUrl, nextUrl: nextHref },
          'Ignoring cross-origin or invalid NuGet feed pagination link',
        );
      }
      pkgUrlList = nextUrl;
    }

    // dep not found if no release, so we can try next registry
    if (dep.releases.length === 0) {
      return null;
    }

    return dep;
  }
}
