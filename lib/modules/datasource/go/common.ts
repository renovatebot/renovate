import { getSourceUrl as githubSourceUrl } from '../../../util/github/url.ts';
import { getSourceUrl as gitlabSourceUrl } from '../../../util/gitlab/url.ts';
import { trimTrailingSlash } from '../../../util/url.ts';
import { BitbucketTagsDatasource } from '../bitbucket-tags/index.ts';
import { ForgejoTagsDatasource } from '../forgejo-tags/index.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';

import { parseGoproxy, parseNoproxy } from './goproxy-parser.ts';
import type { DataSource, GoproxyItem } from './types.ts';

/**
 * The Go module proxy which serves public modules only, and which the Go toolchain uses by default.
 *
 * @see https://go.dev/ref/mod#module-proxy
 */
export const publicGoproxyUrl = 'https://proxy.golang.org';

/**
 * Whether a module's data may be written to a package cache which is shared with others.
 *
 * `GOPRIVATE`/`GONOPROXY` is how the user declares which modules are private, and `GOPROXY` decides who serves the rest: whatever the public proxy serves is public by definition, whereas a self-hosted proxy may serve modules which are not.
 *
 * `direct` only counts as public alongside the public proxy, which is how Go's own default `GOPROXY` is written: there, it is the fallback for what the public proxy doesn't have. On its own it means every module comes from its source, which tells us nothing about who may read it.
 *
 * An unset `GOPROXY` is the default, so it is public too.
 *
 * @see https://go.dev/ref/mod#private-modules
 */
function isPublicProxy({ url }: GoproxyItem): boolean {
  return trimTrailingSlash(url) === publicGoproxyUrl;
}

export function isPublicGoPackage(packageName: string): boolean {
  if (parseNoproxy()?.test(packageName)) {
    return false;
  }

  const proxies = parseGoproxy();

  return proxies.every(
    (proxy) =>
      proxy.url === 'off' ||
      isPublicProxy(proxy) ||
      (proxy.url === 'direct' && proxies.some(isPublicProxy)),
  );
}

export function getSourceUrl(
  dataSource?: DataSource | null,
): string | undefined {
  if (dataSource) {
    const { datasource, registryUrl, packageName } = dataSource;

    switch (datasource) {
      case ForgejoTagsDatasource.id:
        return ForgejoTagsDatasource.getSourceUrl(packageName, registryUrl);
      case GiteaTagsDatasource.id:
        return GiteaTagsDatasource.getSourceUrl(packageName, registryUrl);
      case GithubTagsDatasource.id:
        return githubSourceUrl(packageName, registryUrl);
      case GitlabTagsDatasource.id:
        return gitlabSourceUrl(packageName, registryUrl);
      case BitbucketTagsDatasource.id:
        return BitbucketTagsDatasource.getSourceUrl(packageName, registryUrl);
    }
  }

  return undefined;
}
