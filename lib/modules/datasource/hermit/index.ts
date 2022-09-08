import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import type { GithubRestRelease } from '../../../util/github/types';
import { getApiBaseUrl } from '../../../util/github/url';
import { GithubHttp } from '../../../util/http/github';
import { regEx } from '../../../util/regex';
import { streamToString } from '../../../util/streams';
import { parseUrl } from '../../../util/url';
import { id } from '../../versioning/hermit';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { HermitSearchResult } from './types';

/**
 * Hermit Datasource searches a given package from the specified `hermit-packages`
 * repository. It expects the search manifest to come from an asset `index.json` from
 * a release named index.
 */
export class HermitDatasource extends Datasource {
  static readonly id = 'hermit';

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'first';

  override readonly defaultVersioning = id;

  override readonly defaultRegistryUrls = [
    'https://github.com/cashapp/hermit-packages',
  ];

  pathRegex: RegExp;

  constructor() {
    super(HermitDatasource.id);
    this.http = new GithubHttp(id);
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
      logger.error('registryUrl must be supplied');
      return null;
    }

    const parsedUrl = parseUrl(registryUrl);
    if (parsedUrl === null) {
      logger.warn({ registryUrl }, 'invalid registryUrl given');
      return null;
    }

    if (!registryUrl.startsWith('https://github.com/')) {
      logger.warn({ registryUrl }, 'Only Github registryUrl is supported');
      return null;
    }

    const items = await this.getHermitSearchManifest(parsedUrl);

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
    key: (u) => u.toString(),
  })
  async getHermitSearchManifest(u: URL): Promise<HermitSearchResult[] | null> {
    const registryUrl = u.toString();
    const host = u.host ?? '';
    const groups = this.pathRegex.exec(u.pathname ?? '')?.groups;
    if (!groups) {
      logger.warn(
        { registryUrl },
        'failed to get owner and repo from given url'
      );
      return null;
    }

    const { owner, repo } = groups;

    const apiBaseUrl = getApiBaseUrl(`https://${host}`);

    const indexRelease = await this.http.getJson<GithubRestRelease>(
      `${apiBaseUrl}repos/${owner}/${repo}/releases/tags/index`
    );

    // finds asset with name index.json
    const asset = indexRelease.body.assets.find(
      (asset) => asset.name === 'index.json'
    );

    if (!asset) {
      logger.warn(
        { registryUrl },
        `can't find asset index.json in the given registryUrl`
      );
      return null;
    }

    // stream down the content of index.json
    // Note: need to use stream here with
    // the accept header as octet-stream to
    // download asset from private github repository
    // see GithubDoc:
    // https://docs.github.com/en/rest/releases/assets#get-a-release-asset
    const indexContent = await streamToString(
      this.http.stream(asset.url, {
        headers: {
          accept: 'application/octet-stream',
        },
      })
    );

    try {
      return JSON.parse(indexContent) as HermitSearchResult[];
    } catch (e) {
      logger.warn('error parsing hermit search manifest from remote respond');
    }

    return null;
  }
}
