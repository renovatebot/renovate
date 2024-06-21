import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { HttpError } from '../../../util/http';
import { joinUrlParts } from '../../../util/url';
import * as npmVersioning from '../../versioning/npm';
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

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = npmVersioning.id;

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

    const nixhubPkgUrl = joinUrlParts(
      registryUrl!,
      `/packages/${packageName}?_data=routes/_nixhub.packages.$pkg._index`,
    );

    try {
      const response = await this.http.getJson<NixhubResponse>(nixhubPkgUrl);
      res.releases = response?.body?.releases.map((release) => ({
        version: release.version,
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
