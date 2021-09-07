import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { cache } from '../../util/cache/package/decorator';
import { parse } from '../../util/html';
import { HttpError } from '../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';

export class ArtifactoryDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

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
    if (registryUrl === defaultRegistryUrl) {
      logger.warn(
        'artifactory datasource requires custom registryUrl. Skipping datasource'
      );
      return null;
    }

    const url = `${registryUrl}/${lookupName}`;

    const result: ReleaseResult = {
      releases: [],
    };
    try {
      const response = await this.http.get(url);
      const body = parse(ArtifactoryDatasource.cleanSimpleHtml(response.body));
      const nodes = body.querySelectorAll('a');

      let candidates: string[] = [];
      nodes.forEach((node) => candidates.push(node.innerHTML));

      // filter out hyperlink to navigate to parent folder
      candidates = candidates.filter(
        (candidate) => candidate !== '../' && candidate !== '..'
      );

      candidates.forEach((candidate) => {
        const parsedCandidate: string =
          candidate.slice(-1) === '/' ? candidate.slice(0, -1) : candidate;

        const thisRelease: Release = {
          version: parsedCandidate,
        };
        result.releases.push(thisRelease);
      });

      const logMessage: string = 'of ' + lookupName + ' under ' + url;
      if (result.releases.length) {
        logger.trace(
          'artifactory: Found ' +
            String(result.releases.length) +
            ' ' +
            logMessage
        );
      } else {
        logger.trace('artifactory: Not found any version ' + logMessage);
      }
    } catch (err) {
      // istanbul ignore else: not testable with nock
      if (err instanceof HttpError) {
        if (err.response?.statusCode !== 404) {
          throw new ExternalHostError(err);
        }
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }

  private static cleanSimpleHtml(html: string): string {
    return (
      html
        // preformatted text hides the "a" nodes otherwise
        .replace(/<\/?pre>/g, '')
    );
  }
}
