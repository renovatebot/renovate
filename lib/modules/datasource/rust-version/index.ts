import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { asTimestamp } from '../../../util/timestamp';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { parseManifestUrl } from './parse';
import type { ParsedManifestUrl } from './types';

export class RustVersionDatasource extends Datasource {
  static readonly id = 'rust-version';
  static readonly defaultRegistryUrl = 'https://static.rust-lang.org';

  constructor() {
    super(RustVersionDatasource.id);
  }

  override readonly defaultRegistryUrls = [
    RustVersionDatasource.defaultRegistryUrl,
  ];

  override readonly customRegistrySupport = false;

  override readonly registryStrategy = 'first' as const;

  override readonly defaultVersioning = 'rust-release-channel';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the release manifest URL.';

  override readonly sourceUrlSupport = 'package' as const;
  override readonly sourceUrlNote =
    'The source URL is set to the Rust programming language GitHub repository.';

  override readonly caching = true;

  private async getManifests(
    registryUrl: string,
  ): Promise<ParsedManifestUrl[]> {
    const response = await this.http.getPlain(registryUrl);
    const manifestsContent = response.body;
    const lines = manifestsContent.split('\n');

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

  @cache({
    namespace: `datasource-${RustVersionDatasource.id}`,
    key: ({ registryUrl }: GetReleasesConfig) => registryUrl ?? 'default',
  })
  async getReleases({
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const baseUrl = registryUrl ?? RustVersionDatasource.defaultRegistryUrl;
    const url = new URL('manifests.txt', baseUrl);

    let parsedResults: ParsedManifestUrl[];
    try {
      parsedResults = await this.getManifests(url.toString());
    } catch (err) {
      this.handleGenericErrors(err);
    }

    // Filter out stable and beta channels (not concrete versions)
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
}
