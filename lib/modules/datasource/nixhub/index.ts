import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { HttpError } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import * as nixhubVersioning from '../../versioning/nixhub';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';
import type { NixhubResponse } from './types';

export class NixhubDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;
  override readonly releaseTimestampSupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = nixhubVersioning.id;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const res: ReleaseResult = {
      homepage: 'https://www.nixhub.io',
      releases: [],
    };

    logger.trace({ registryUrl, packageName }, 'fetching nixhub release');

    const nixhubPkgUrl = joinUrlParts(registryUrl!, `/pkg?name=${packageName}`);

    try {
      const response = await this.http.getJson<NixhubResponse>(nixhubPkgUrl);
      res.releases = response?.body?.releases.map((release) => ({
        version: release.version,
        releaseTimestamp: release.last_updated,
      }));
    } catch (err) {
      // istanbul ignore else: not testable with nock
      if (err instanceof HttpError) {
        if (err.response?.statusCode !== 404) {
          throw new ExternalHostError(err);
        }
      }
      this.handleGenericErrors(err);
    }
    return res.releases.length ? res : null;
  }
}
