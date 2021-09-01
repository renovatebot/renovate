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

  override readonly caching = false;

  //  override readonly defaultVersioning = rubyVersioningId;

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl }: GetReleasesConfig) => `${registryUrl}`,
  })
  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const url = `${registryUrl}/${lookupName}`;

    const result: ReleaseResult = {
      homepage: 'https://jfrog.com/artifactory',
      sourceUrl: url,
      releases: [],
    };
    try {
      const response = await this.http.get(url);
      logger.debug('sourceUrl: ' + result.sourceUrl);
      logger.debug('lookupName: ' + lookupName);
      logger.debug('response.body\n');
      logger.debug(response.body);
      const body: HTMLElement = parse(response.body);
      // logger.debug('parsed body\n');
      // logger.debug(body);
      const nodes = body.querySelectorAll('a');
      logger.debug('nodes:' + String(nodes.length));

      let candidates: string[] = [];
      nodes.forEach((node) => candidates.push(node.innerHTML));
      candidates = candidates.filter((candidate) => candidate !== '../');

      candidates.forEach((candidate) => {
        const parsedCandidate: string =
          candidate.slice(-1) === '/' ? candidate.slice(0, -1) : candidate;

        const thisRelease: Release = {
          version: '',
        };
        thisRelease.version = parsedCandidate;
        result.releases.push(thisRelease);
      });

      if (result.releases.length) {
        logger.debug('Found ' + String(result.releases.length) + ' releases');
      } else {
        logger.debug(
          'Not found any version of ' + lookupName + ' under ' + url
        );
      }
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.response?.statusCode !== 404) {
          throw new ExternalHostError(err);
        }
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}
