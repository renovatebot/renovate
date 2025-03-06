import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { HttpError } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import * as devboxVersioning from '../../versioning/devbox';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';
import { DevboxResponse } from './schema';

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

    const devboxPkgUrl = joinUrlParts(
      registryUrl!,
      `/pkg?name=${encodeURIComponent(packageName)}`,
    );

    try {
      const response = await this.http.getJson(devboxPkgUrl, DevboxResponse);
      res.releases = response.body.releases;
      res.homepage = response.body.homepage;
    } catch (err) {
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
