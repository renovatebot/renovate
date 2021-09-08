import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { parse } from '../../util/html';
import { HttpError } from '../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { datasource } from './common';

export class ArtifactoryDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;

  override readonly caching = true;

  override readonly registryStrategy = 'merge';

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl }: GetReleasesConfig) => `${registryUrl}`,
  })
  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl) {
      logger.warn(
        'artifactory datasource requires custom registryUrl. Skipping datasource'
      );
      return null;
    }

    const url = `${registryUrl}/${lookupName}`;
    const contextForLogging: string = lookupName + ' under ' + url;

    const result: ReleaseResult = {
      releases: [],
    };
    try {
      const response = await this.http.get(url);
      const body = parse(response.body, {
        blockTextElements: {
          script: true,
          noscript: true,
          style: true,
        },
      });
      const nodes = body.querySelectorAll('a');

      nodes
        .filter(
          // filter out hyperlink to navigate to parent folder
          (node) => node.innerHTML !== '../' && node.innerHTML !== '..'
        )
        .forEach(
          // extract version and published time for each node
          (node) => {
            const version: string =
              node.innerHTML.slice(-1) === '/'
                ? node.innerHTML.slice(0, -1)
                : node.innerHTML;

            const published = ArtifactoryDatasource.parseReleaseTimestamp(
              node.nextSibling?.text
            );

            const thisRelease: Release = {
              version,
              releaseTimestamp: published,
            };

            result.releases.push(thisRelease);
          }
        );

      if (result.releases.length) {
        logger.trace(
          'artifactory: Found ' +
            String(result.releases.length) +
            ' versions of ' +
            contextForLogging
        );
      } else {
        logger.trace(
          'artifactory: Not found any version of ' + contextForLogging
        );
      }
    } catch (err) {
      // istanbul ignore else: not testable with nock
      if (err instanceof HttpError) {
        if (err.response?.statusCode === 404) {
          logger.warn(
            'artifactory: "Not Found" error for ' + contextForLogging
          );
          return null;
        }
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }

  private static parseReleaseTimestamp(rawText: string): string {
    return rawText.trim().replace(/ ?-$/, '');
  }
}
