import { joinUrlParts } from '../../../util/url';
import * as npmVersioning from '../../versioning/npm';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { defaultRegistryUrl } from './common';

export class NixhubDatasource extends Datasource {
  static readonly id = 'nixhub';

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = npmVersioning.id;

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  constructor() {
    super(NixhubDatasource.id);
  }

  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const res: ReleaseResult = {
      homepage: 'https://www.nixhub.io/',
      releases: [],
    };

    const nixhubPkgUrl = joinUrlParts(
      defaultRegistryUrl,
      `/packages/${config.packageName}?_data=routes/_nixhub.packages.$pkg._index`,
    );

    const response = await this.http.get(nixhubPkgUrl);
    const parsedResponse: { releases: { version: string }[] } = JSON.parse(
      response.body,
    );
    res.releases = parsedResponse.releases;
    return res;
  }
}
