import { regEx } from '../../../util/regex';
import { asTimestamp } from '../../../util/timestamp';
import { id as semverId } from '../../versioning/semver';
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

  override readonly defaultVersioning = semverId;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `release_date` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'We use the URL: https://github.com/flutter/flutter.';

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
        await this.http.getJsonUnchecked<FlutterResponse>(
          `${registryUrl}/flutter_infra_release/releases/releases_linux.json`,
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
          releaseTimestamp: asTimestamp(release_date),
          isStable: channel === 'stable',
        }));
      return result.releases.length ? result : null;
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }
}
