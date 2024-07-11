import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import is from '@sindresorhus/is';
import { fetchPackages } from './util';
import { GithubHttp } from '../../../util/http/github';

export class BitriseDatasource extends Datasource {
  static readonly id = 'bitrise';

  constructor() {
    super(BitriseDatasource.id);
  }

  override readonly customRegistrySupport = true;

  override readonly defaultRegistryUrls = ['https://github.com/bitrise-io/bitrise-steplib.git'];

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published_at` field in the results.';
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The source URL is determined from the `source_code_url` field of the release object in the results.';

  async getReleases({
                      packageName,
                      registryUrl,
                    }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const client = new GithubHttp(this.id)
    const packages = await fetchPackages(client, registryUrl);
    if (!packages) {
      return null;
    }
    const releases = packages[packageName];

    const filtered = releases?.filter(is.truthy);

    if (!filtered?.length) {
      return null;
    }
    return { releases: filtered };
  }
}
