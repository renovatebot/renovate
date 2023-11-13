import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { DartResponse } from './types';

export const stableVersionRegex = regEx(/^\d+\.\d+\.\d+$/);

export class DartVersionDatasource extends Datasource {
  static readonly id = 'dart-version';

  constructor() {
    super(DartVersionDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://storage.googleapis.com'];

  override readonly caching = true;

  private readonly channels = ['stable', 'beta', 'dev'];

  async getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }
    const result: ReleaseResult = {
      homepage: 'https://dart.dev/',
      sourceUrl: 'https://github.com/dart-lang/sdk',
      registryUrl,
      releases: [],
    };
    try {
      for (const channel of this.channels) {
        const resp = (
          await this.http.getJson<DartResponse>(
            `${registryUrl}/storage/v1/b/dart-archive/o?delimiter=%2F&prefix=channels%2F${channel}%2Frelease%2F&alt=json`,
          )
        ).body;
        const releases = this.getReleasesFromResponse(channel, resp.prefixes);
        result.releases.push(...releases);
      }
    } catch (err) {
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }

  private getReleasesFromResponse(
    channel: string,
    prefixes: string[],
  ): Release[] {
    return prefixes
      .map((prefix) => this.getVersionFromPrefix(prefix))
      .filter(is.string)
      .filter((version) => {
        if (
          version === 'latest' ||
          // The API response contains a stable version being released as a non-stable
          // release. So we filter out these releases here.
          (channel !== 'stable' && stableVersionRegex.test(version))
        ) {
          return false;
        }
        return true;
      })
      .map((version) => ({ version, isStable: channel === 'stable' }));
  }

  // Prefix should have a format of "channels/stable/release/2.9.3/"
  private getVersionFromPrefix(prefix: string): string | undefined {
    const parts = prefix.split('/');
    return parts[parts.length - 2];
  }
}
