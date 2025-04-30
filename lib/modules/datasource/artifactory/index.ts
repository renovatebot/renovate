import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { parse } from '../../../util/html';
import { HttpError } from '../../../util/http';
import { regEx } from '../../../util/regex';
import { asTimestamp } from '../../../util/timestamp';
import { joinUrlParts } from '../../../util/url';
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

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the date-like text, next to the version hyperlink tag in the results.';

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#22198)
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl) {
      logger.warn(
        { packageName },
        'artifactory datasource requires custom registryUrl. Skipping datasource',
      );
      return null;
    }

    const url = joinUrlParts(registryUrl, packageName);

    const result: ReleaseResult = {
      releases: [],
    };
    try {
      const response = await this.http.getText(url);
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
          (node) => node.innerHTML !== '../' && node.innerHTML !== '..',
        )
        .forEach(
          // extract version and published time for each node
          (node) => {
            const version: string = node.innerHTML.endsWith('/')
              ? node.innerHTML.slice(0, -1)
              : node.innerHTML;

            const releaseTimestamp = asTimestamp(
              node.nextSibling?.text?.trimStart()?.split(regEx(/\s{2,}/))?.[0],
            );

            const thisRelease: Release = {
              version,
              releaseTimestamp,
            };

            result.releases.push(thisRelease);
          },
        );

      if (result.releases.length) {
        logger.trace(
          { registryUrl, packageName, versions: result.releases.length },
          'artifactory: Found versions',
        );
      } else {
        logger.trace(
          { registryUrl, packageName },
          'artifactory: No versions found',
        );
      }
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.response?.statusCode === 404) {
          logger.warn(
            { registryUrl, packageName },
            'artifactory: `Not Found` error',
          );
          return null;
        }
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}
