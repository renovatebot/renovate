import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import * as rustVersioning from '../../versioning/rust-release-channel/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { type ParsedManifestUrl, parseManifestUrl } from './parse.ts';

export class RustVersionDatasource extends Datasource {
  static readonly id = 'rust-version';

  static readonly defaultRegistryUrls = ['https://static.rust-lang.org'];

  override readonly defaultVersioning = rustVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is parsed from the release manifest URL.';

  override readonly sourceUrlSupport = 'package';

  override readonly caching = true;

  constructor() {
    super(RustVersionDatasource.id);
  }

  static getRegistryURL(registryUrl?: string): string {
    // fallback to default API endpoint if custom not provided
    return registryUrl ?? this.defaultRegistryUrls[0];
  }

  private async getManifests(
    registryUrl: string,
  ): Promise<ParsedManifestUrl[]> {
    const response = await this.http.getPlain(registryUrl);
    const lines = response.body.split('\n');

    const parsedResults = [];
    for (const line of lines) {
      const parsed = parseManifestUrl(line);
      if (parsed) {
        parsedResults.push(parsed);
      } else {
        logger.warn({ line }, 'Failed to parse manifest URL');
      }
    }

    return parsedResults;
  }

  async _getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const baseUrl = RustVersionDatasource.getRegistryURL(registryUrl);
    const url = new URL('manifests.txt', baseUrl);

    let parsedResults: ParsedManifestUrl[];
    try {
      parsedResults = await this.getManifests(url.toString());
    } catch (err) {
      this.handleGenericErrors(err);
    }

    // Filter out dated stable and beta channel releases
    // (not supported by the `rust-release-channel` versioning)
    const filteredResults = parsedResults.filter(
      (result) => result.version !== 'stable' && result.version !== 'beta',
    );

    // Transform to version strings and deduplicate
    const versionMap = new Map<string, string>();
    for (const parsed of filteredResults) {
      const version =
        parsed.version === 'nightly'
          ? `nightly-${parsed.date}`
          : parsed.version;

      // Keep latest date for each version
      versionMap.set(version, parsed.date);
    }

    const releaseResult: ReleaseResult = {
      releases: [],
      homepage: 'https://rust-lang.org/',
      sourceUrl: 'https://github.com/rust-lang/rust',
      changelogUrl: 'https://github.com/rust-lang/rust/blob/main/RELEASES.md',
    };

    for (const [version, date] of versionMap.entries()) {
      const releaseTimestamp = asTimestamp(date);
      releaseResult.releases.push({ version, releaseTimestamp });
    }

    return releaseResult;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${RustVersionDatasource.id}`,
        key: RustVersionDatasource.getRegistryURL(config.registryUrl),
      },
      () => this._getReleases(config),
    );
  }
}
