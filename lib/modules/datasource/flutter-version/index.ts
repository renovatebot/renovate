import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { FlutterRelease } from './types';

export class FlutterDatasource extends Datasource {
  static readonly id = 'flutter-version';

  constructor() {
    super(FlutterDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://storage.googleapis.com'];

  override readonly caching = true;

  async getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }
    const result: ReleaseResult = {
      homepage: 'https://flutter.dev',
      sourceUrl: 'https://github.com/flutter/flutter',
      registryUrl,
      releases: [],
    };
    try {
      const resp = (
        await this.http.getJson<FlutterRelease>(
          `${registryUrl}/flutter_infra_release/releases/releases_linux.json`
        )
      ).body;
      result.releases.push(
        ...resp.releases.map(({ version, release_date, channel }) => ({
          version,
          releaseTimestamp: release_date,
          isStable: channel === 'stable',
        }))
      );
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}
