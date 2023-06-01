import url from 'node:url';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { parse } from '../../../util/html';
import { regEx } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { datasource } from './common';

export class HtmlLinksDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;

  override readonly caching = true;

  override readonly defaultVersioning = 'loose';

  override readonly registryStrategy = 'merge';

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl ?? ''} ${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl) {
      logger.warn(
        { packageName },
        'html-links datasource requires custom registryUrl. Skipping datasource'
      );
      return null;
    }

    const urlRegex = regEx(packageName);

    const result: ReleaseResult = {
      releases: [],
    };
    try {
      const response = await this.http.get(registryUrl);
      const body = parse(response.body);

      // node-html-parser doesn't parse anything inside <pre>
      // but, for example, nginx wraps directory listings in <pre>
      const pres = body.getElementsByTagName('pre').map((pre) => parse(pre.textContent));

      const links = [body, ...pres].flatMap((e) => e.getElementsByTagName('a'));
      const hrefs = links
        .map((node) => node.getAttribute('href'))
        .filter(is.truthy);

      const resolved = hrefs
        .map((href) => url.resolve(response.url, href));

      const matches = resolved
        .map((href) => urlRegex.exec(href))
        .filter(is.truthy);

      for (const match of matches) {
        const [, version] = match;
        const downloadUrl = match.input;

        const thisRelease: Release = {
          version,
          downloadUrl,
        };

        result.releases.push(thisRelease);
      }

      if (result.releases.length) {
        logger.trace(
          { registryUrl, packageName, versions: result.releases.length },
          'html-links: Found versions'
        );
      } else {
        logger.trace(
          { registryUrl, packageName },
          'html-links: No versions found'
        );
      }
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}
