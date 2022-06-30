import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { GithubHttp } from '../../../util/http/github';
import { regEx } from '../../../util/regex';
import { streamToString } from '../../../util/streams';
import { id } from '../../versioning/hermit';
import { Datasource } from '../datasource';
import { GithubReleasesDatasource } from '../github-releases';
import { getApiBaseUrl } from '../github-releases/common';
import type {
  GithubRelease,
  GithubReleaseAsset,
} from '../github-releases/types';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { HermitSearchResult } from './types';

/**
 * Hermit Datasource searches a given package from the specified `hermit-pakcages`
 * repository. It expects the search manifest to come from an asset `index.json` from
 * a release named index. Any error fetching, parsing and finding the package from the given
 * registryUrl will be thrown
 */
export class HermitDatasource extends Datasource {
  static readonly id = 'hermit';

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = id;

  override readonly defaultRegistryUrls = [
    'https://github.com/cashapp/hermit-packages',
  ];

  githubHttp: GithubHttp;

  pathRegex: RegExp;

  constructor() {
    super(HermitDatasource.id);
    this.githubHttp = new GithubHttp(GithubReleasesDatasource.id);
    this.pathRegex = regEx('^\\/(?<owner>[^/]+)\\/(?<repo>[^/]+)$');
  }

  @cache({
    namespace: `datasource-hermit-package`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl ?? ''}-${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace(`HermitDataSource.getReleases()`);

    if (!registryUrl) {
      logger.debug('registryUrl must be supplied');
      return null;
    }

    if (!registryUrl.startsWith('https://github.com/')) {
      logger.debug({ registryUrl }, 'Only Github registryUrl is supported');
      return null;
    }

    const items = await this.getHermitSearchManifest(registryUrl);

    if (items === null) {
      return null;
    }

    const res = items.find((i) => i.Name === packageName);

    if (!res) {
      logger.debug({ packageName, registryUrl }, 'cannot find hermit package');
      return null;
    }

    const sourceUrl = res.Repository;

    return {
      sourceUrl,
      releases: [
        ...res.Versions.map((v) => ({
          version: v,
          sourceUrl,
        })),
        ...res.Channels.map((v) => ({
          version: v,
          sourceUrl,
        })),
      ],
    };
  }

  /**
   * getHermitSearchManifest fetch the index.json from release
   * named index, parses it and returned the parsed JSON result
   */
  @cache({
    namespace: `datasource-hermit-search-manifest`,
    key: ({ registryUrl }: GetReleasesConfig) => registryUrl ?? '',
  })
  async getHermitSearchManifest(
    registryUrl: string
  ): Promise<HermitSearchResult[] | null> {
    const u = new URL(registryUrl);
    const host = u.host;
    const groups = this.pathRegex.exec(u.pathname)?.groups;

    if (!groups) {
      return null;
    }

    const { owner, repo } = groups;

    const apiBaseUrl = getApiBaseUrl(`https://${host}`);

    const indexRelease = await this.githubHttp.getJson<GithubRelease>(
      `${apiBaseUrl}repos/${owner}/${repo}/releases/tags/index`
    );

    const asset = indexRelease.body.assets.find(
      (asset: GithubReleaseAsset) => asset.name === 'index.json'
    );

    if (!asset) {
      logger.debug(
        { registryUrl },
        `can't find asset index.json in the given registryUrl`
      );
      return null;
    }

    const indexContent = await streamToString(
      this.githubHttp.stream(asset.url, {
        headers: {
          accept: 'application/octet-stream',
        },
      })
    );

    return JSON.parse(indexContent) as HermitSearchResult[];
  }
}
