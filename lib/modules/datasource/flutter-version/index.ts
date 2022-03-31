import { regEx } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { FlutterResponse } from './types';

export const stableVersionRegex = regEx(/^\d+\.\d+\.\d+$/);

export class FlutterVersionDatasource extends Datasource {
  static readonly id = 'flutter-version';

  constructor() {
    super(FlutterVersionDatasource.id);
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
        await this.http.getJson<FlutterResponse>(
          `${registryUrl}/flutter_infra_release/releases/releases_linux.json`
        )
      ).body;
      result.releases = resp.releases
        // The API response contains a stable version being released as a non-stable
        // release. And so we filter out these releases here.
        .filter(({ version, channel }) => {
          if (stableVersionRegex.test(version)) {
            return channel === 'stable';
          }
          return true;
        })
        .map(({ version, release_date, channel }) => ({
          version,
          releaseTimestamp: release_date,
          isStable: channel === 'stable',
        }));
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }
}
