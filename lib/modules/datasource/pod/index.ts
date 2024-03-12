import crypto from 'node:crypto';
import { HOST_DISABLED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpError } from '../../../util/http';
import { GithubHttp } from '../../../util/http/github';
import { newlineRegex, regEx } from '../../../util/regex';
import { Datasource } from '../datasource';
import { massageGithubUrl } from '../metadata';
import type { GetReleasesConfig, ReleaseResult } from '../types';

type URLFormatOptions =
  | 'withShardWithSpec'
  | 'withShardWithoutSpec'
  | 'withSpecsWithoutShard'
  | 'withoutSpecsWithoutShard';

function shardParts(packageName: string): string[] {
  return crypto
    .createHash('md5')
    .update(packageName)
    .digest('hex')
    .slice(0, 3)
    .split('');
}

const githubRegex = regEx(
  /(?<hostURL>^https:\/\/[a-zA-Z0-9-.]+)\/(?<account>[^/]+)\/(?<repo>[^/]+?)(?:\.git|\/.*)?$/,
);

function releasesGithubUrl(
  packageName: string,
  opts: {
    hostURL: string;
    account: string;
    repo: string;
    useShard: boolean;
    useSpecs: boolean;
  },
): string {
  const { hostURL, account, repo, useShard, useSpecs } = opts;
  const prefix =
    hostURL && hostURL !== 'https://github.com'
      ? `${hostURL}/api/v3/repos`
      : 'https://api.github.com/repos';
  const shard = shardParts(packageName).join('/');
  // `Specs` in the pods repo URL is a new requirement for legacy support also allow pod repo URL without `Specs`
  const packageNamePath = useSpecs ? `Specs/${packageName}` : packageName;
  const shardPath = useSpecs
    ? `Specs/${shard}/${packageName}`
    : `${shard}/${packageName}`;
  const suffix = useShard ? shardPath : packageNamePath;
  return `${prefix}/${account}/${repo}/contents/${suffix}`;
}

function handleError(packageName: string, err: HttpError): void {
  const errorData = { packageName, err };

  const statusCode = err.response?.statusCode ?? 0;
  if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
    logger.warn({ packageName, err }, `CocoaPods registry failure`);
    throw new ExternalHostError(err);
  }

  if (statusCode === 401) {
    logger.debug(errorData, 'Authorization error');
  } else if (statusCode === 404) {
    logger.debug(errorData, 'Package lookup error');
  } else if (err.message === HOST_DISABLED) {
    logger.trace(errorData, 'Host disabled');
  } else {
    logger.warn(errorData, 'CocoaPods lookup failure: Unknown error');
  }
}

function isDefaultRepo(url: string): boolean {
  const match = githubRegex.exec(url);
  if (match?.groups) {
    const { account, repo } = match.groups;
    return (
      account.toLowerCase() === 'cocoapods' && repo.toLowerCase() === 'specs'
    ); // https://github.com/CocoaPods/Specs.git
  }
  return false;
}

function releasesCDNUrl(packageName: string, registryUrl: string): string {
  const shard = shardParts(packageName).join('_');
  return `${registryUrl}/all_pods_versions_${shard}.txt`;
}

export class PodDatasource extends Datasource {
  static readonly id = 'pod';

  override readonly defaultRegistryUrls = ['https://cdn.cocoapods.org'];

  override readonly registryStrategy = 'hunt';

  githubHttp: GithubHttp;

  constructor() {
    super(PodDatasource.id);
    this.githubHttp = new GithubHttp(PodDatasource.id);
  }

  private async requestCDN(
    url: string,
    packageName: string,
  ): Promise<string | null> {
    try {
      const resp = await this.http.get(url);
      if (resp?.body) {
        return resp.body;
      }
    } catch (err) {
      handleError(packageName, err);
    }

    return null;
  }

  private async requestGithub<T = unknown>(
    url: string,
    packageName: string,
  ): Promise<T | null> {
    try {
      const resp = await this.githubHttp.getJson<T>(url);
      if (resp?.body) {
        return resp.body;
      }
    } catch (err) {
      handleError(packageName, err);
    }

    return null;
  }

  private async getReleasesFromGithub(
    packageName: string,
    opts: { hostURL: string; account: string; repo: string },
    useShard = true,
    useSpecs = true,
    urlFormatOptions: URLFormatOptions = 'withShardWithSpec',
  ): Promise<ReleaseResult | null> {
    const url = releasesGithubUrl(packageName, { ...opts, useShard, useSpecs });
    const resp = await this.requestGithub<{ name: string }[]>(url, packageName);
    if (resp) {
      const releases = resp.map(({ name }) => ({ version: name }));
      return { releases };
    }

    // support different url formats
    switch (urlFormatOptions) {
      case 'withShardWithSpec':
        return this.getReleasesFromGithub(
          packageName,
          opts,
          true,
          false,
          'withShardWithoutSpec',
        );
      case 'withShardWithoutSpec':
        return this.getReleasesFromGithub(
          packageName,
          opts,
          false,
          true,
          'withSpecsWithoutShard',
        );
      case 'withSpecsWithoutShard':
        return this.getReleasesFromGithub(
          packageName,
          opts,
          false,
          false,
          'withoutSpecsWithoutShard',
        );
      case 'withoutSpecsWithoutShard':
      default:
        return null;
    }
  }

  private async getReleasesFromCDN(
    packageName: string,
    registryUrl: string,
  ): Promise<ReleaseResult | null> {
    const url = releasesCDNUrl(packageName, registryUrl);
    const resp = await this.requestCDN(url, packageName);
    if (resp) {
      const lines = resp.split(newlineRegex);
      for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx];
        const [name, ...versions] = line.split('/');
        if (name === packageName.replace(regEx(/\/.*$/), '')) {
          const releases = versions.map((version) => ({ version }));
          return { releases };
        }
      }
    }
    return null;
  }

  @cache({
    ttlMinutes: 30,
    namespace: `datasource-${PodDatasource.id}`,
    key: ({ packageName, registryUrl }: GetReleasesConfig) =>
      // TODO: types (#22198)
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const podName = packageName.replace(regEx(/\/.*$/), '');
    let baseUrl = registryUrl.replace(regEx(/\/+$/), '');
    // In order to not abuse github API limits, query CDN instead
    if (isDefaultRepo(baseUrl)) {
      [baseUrl] = this.defaultRegistryUrls;
    }

    let result: ReleaseResult | null = null;
    const match = githubRegex.exec(baseUrl);
    if (match?.groups) {
      baseUrl = massageGithubUrl(baseUrl);
      const { hostURL, account, repo } = match.groups;
      const opts = { hostURL, account, repo };
      result = await this.getReleasesFromGithub(podName, opts);
    } else {
      result = await this.getReleasesFromCDN(podName, baseUrl);
    }

    return result;
  }
}
