import { regEx } from '../../../util/regex.ts';
import { trimTrailingSlash } from '../../../util/url.ts';

import { parseGoproxy, parseNoproxy } from './goproxy-parser.ts';
import { getGoTagDatasource } from './tag-datasources.ts';
import type { DataSource, GoproxyItem } from './types.ts';

/**
 * A version which a Go proxy derives from an untagged commit, of the shape
 * `vX.Y.Z-<timestamp>-<digest>`.
 *
 * @see https://go.dev/ref/mod#pseudo-versions
 */
export const pseudoVersionRegex = regEx(
  /v\d+\.\d+\.\d+-(?:\w+\.)?(?:0\.)?(?<timestamp>\d{14})-(?<digest>[a-f0-9]{12})/i,
);

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
  if (!dataSource) {
    return undefined;
  }

  const { datasource, registryUrl, packageName } = dataSource;
  return getGoTagDatasource(datasource)?.getSourceUrl?.(
    packageName,
    registryUrl,
  );
}
