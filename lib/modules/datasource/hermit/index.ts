import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { GithubHttp } from '../../../util/http/github';
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

const datasource = 'hermit';

/**
 * Hermit Datasource searches a given package from the specified `hermit-pakcages`
 * repository. It expects the search manifest to come from an asset `index.json` from
 * a release named index. Any error fetching, parsing and finding the package from the given
 * registryUrl will be thrown
 */
export class HermitDatasource extends Datasource {
  static readonly id = datasource;

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = id;

  override readonly defaultRegistryUrls = [
    'https://github.com/cashapp/hermit-packages',
  ];

  githubHttp: GithubHttp;

  constructor() {
    super(HermitDatasource.id);
    this.githubHttp = new GithubHttp(GithubReleasesDatasource.id);
  }

  @cache({
    namespace: `datasource-${datasource}-package`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      `${registryUrl}-${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace(`HermitDataSource.getReleases()`);

    if (!registryUrl) {
      throw new Error('registryUrl must be supplied');
    }

    const res = await this.getHermitRelease(packageName, registryUrl);
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
    namespace: `datasource-${datasource}-search-manifest`,
    key: ({ registryUrl }: GetReleasesConfig) => registryUrl ?? '',
  })
  async getHermitSearchManifest(
    registryUrl: string
  ): Promise<HermitSearchResult[]> {
    if (!registryUrl.startsWith('https://github.com')) {
      throw new Error(`Only Github registryUrl is supported`);
    }

    const u = new URL(registryUrl);
    const host = u.host;
    const path = u.pathname;

    const parts = path.split('/').filter((p) => p !== '');

    if (parts.length < 2) {
      throw new Error(`can't find owner & repo in the url`);
    }

    logger.debug(
      { registryUrl },
      `fetching hermit search manifest from repository's index release`
    );

    const owner = parts[0];
    const repo = parts[1];
    const apiBaseUrl = getApiBaseUrl(`https://${host}`);

    const indexRelease = await this.githubHttp.getJson<GithubRelease>(
      `${apiBaseUrl}repos/${owner}/${repo}/releases/tags/index`
    );

    const asset = indexRelease.body.assets.find(
      (asset: GithubReleaseAsset) => asset.name === 'index.json'
    );

    if (!asset) {
      throw new Error(
        `cannot find asset index.json in the given registryUrl ${registryUrl}`
      );
    }

    // fetches the content of the asset via calling back to the url
    // (not browser_download_url) to work with private
    // repositories
    const indexContent = await this.githubHttp.get(asset.url, {
      headers: {
        accept: 'application/octet-stream',
      },
    });

    return JSON.parse(indexContent.body) as HermitSearchResult[];
  }

  /**
   * getHermitRelease fetches the search result manifest and search package name inside
   */
  async getHermitRelease(
    name: string,
    registryUrl: string
  ): Promise<HermitSearchResult> {
    const items = await this.getHermitSearchManifest(registryUrl);

    const searchResult = items.find((i) => i.Name === name);

    if (!searchResult) {
      throw new Error(`cannot find package ${name} in the search result`);
    }

    return searchResult;
  }
}
