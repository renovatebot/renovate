import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { datasource, registryUrl } from './common';
import type { EndoflifeDateVersion } from './types';

export class EndoflifeDatePackagesource extends Datasource {
  static readonly id = datasource;

  override readonly defaultRegistryUrls = [registryUrl];
  override readonly caching = true;
  override readonly defaultVersioning = 'loose';

  constructor() {
    super(EndoflifeDatePackagesource.id);
  }

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (!registryUrl) {
      return null;
    }

    logger.trace(`${datasource}.getReleases(${registryUrl}, ${packageName})`);

    const result: ReleaseResult = {
      releases: [],
    };

    let response: { body: EndoflifeDateVersion[] };

    const url = joinUrlParts(registryUrl, `${packageName}.json`);

    try {
      response = await this.http.getJson(url);

      response.body.forEach((cycle) => {
        const thisRelease: Release = {
          version: cycle.cycle as string,
          releaseTimestamp: cycle.releaseDate,
        };
        result.releases.push(thisRelease);
      });

      return result.releases.length ? result : null;
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }
}
