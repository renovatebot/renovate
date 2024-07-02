import crypto from 'node:crypto';
import { pathExistsSync, readdir } from 'fs-extra';
import Git from 'simple-git';
import upath from 'upath';
import { HOST_DISABLED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as memCache from '../../../util/cache/memory';
import { cache } from '../../../util/cache/package/decorator';
import { privateCacheDir } from '../../../util/fs';
import { simpleGitConfig } from '../../../util/git/config';
import { toSha256 } from '../../../util/hash';
import type { HttpError } from '../../../util/http';
import { GithubHttp } from '../../../util/http/github';
import { newlineRegex, regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
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

  private async getReleasesFromGit(
    packageName: string,
    registryUrl: string,
  ): Promise<ReleaseResult | null> {
    const cacheKey = `crate-datasource/registry-clone-path/${registryUrl}`;
    const cacheKeyForError = `crate-datasource/registry-clone-path/${registryUrl}/error`;

    // We need to ensure we don't run `git clone` in parallel. Therefore we store
    // a promise of the running operation in the mem cache, which in the end resolves
    // to the file path of the cloned repository.

    const clonePathPromise: Promise<string> | null = memCache.get(cacheKey);
    let clonePath: string;

    if (clonePathPromise) {
      clonePath = await clonePathPromise;
    } else {
      const url = parseUrl(registryUrl);
      if (!url) {
        logger.debug(`Could not parse registry URL ${registryUrl}`);
        return null;
      }

      clonePath = upath.join(
        privateCacheDir(),
        PodDatasource.cacheDirFromUrl(url),
      );
      logger.info(
        { clonePath, registryUrl },
        `Cloning private cocoapods registry`,
      );

      const git = Git({ ...simpleGitConfig(), maxConcurrentProcesses: 1 });
      const clonePromise = git.clone(registryUrl, clonePath, {
        '--depth': 1,
      });

      memCache.set(
        cacheKey,
        clonePromise.then(() => clonePath).catch(() => null),
      );

      try {
        await clonePromise;
      } catch (err) {
        logger.warn(
          { err, packageName, registryUrl },
          'failed cloning git registry',
        );
        memCache.set(cacheKeyForError, err);

        return null;
      }
    }

    if (!clonePath) {
      const err = memCache.get(cacheKeyForError);
      logger.warn(
        { err, packageName, registryUrl },
        'Previous git clone failed, bailing out.',
      );

      return null;
    }
    // Recursively get directory contents
    const modulePath = upath.join(clonePath, packageName);
    if (!pathExistsSync(modulePath)) {
      return null;
    }
    const spec_files = (await readdir(modulePath, { recursive: true }))
      .map((item) => item.toString()) // Convert buffers to strings
      .filter(
        (item) => item.endsWith('.podspec.json') || item.endsWith('.podspec'),
      );
    const modulesByVersion = spec_files.map((item) => {
      const parts = item.split('/');
      const version = parts[0];
      return {
        version,
      };
    });
    // todo: Not return but use a single let result
    return { releases: modulesByVersion };
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

  private static cacheDirFromUrl(url: URL): string {
    const proto = url.protocol.replace(regEx(/:$/), '');
    const host = url.hostname;
    const hash = toSha256(url.pathname).substring(0, 7);

    return `cocoapods-registry-${proto}-${host}-${hash}`;
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
    const privateGitRegistry =
      process.env.COCOAPODS_GIT_REPOSITORIES?.split(',');

    if (privateGitRegistry?.includes(registryUrl)) {
      result = await this.getReleasesFromGit(podName, registryUrl);
    } else if (match?.groups) {
      baseUrl = massageGithubUrl(baseUrl);
      const { hostURL, account, repo } = match.groups;
      const opts = { hostURL, account, repo };
      result = await this.getReleasesFromGithub(podName, opts);
    } else if (this.defaultRegistryUrls.includes(baseUrl)) {
      result = await this.getReleasesFromCDN(podName, baseUrl);
    }

    return result;
  }
}
