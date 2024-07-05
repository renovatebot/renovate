import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { HttpError } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import * as devboxVersioning from '../../versioning/devbox';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';
import type { DevboxResponse } from './types';

export class DevboxDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;
  override readonly releaseTimestampSupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = devboxVersioning.id;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const res: ReleaseResult = {
      releases: [],
    };

    logger.trace({ registryUrl, packageName }, 'fetching devbox release');

    const devboxPkgUrl = joinUrlParts(registryUrl!, `/pkg?name=${packageName}`);

    try {
      const response = await this.http.getJson<DevboxResponse>(devboxPkgUrl);
      res.homepage = response?.body?.homepage_url;
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
