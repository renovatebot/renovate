import { isNonEmptyString } from '@sindresorhus/is';
import type { HostRule } from '../../../types/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { trimTrailingSlash } from '../../../util/url.ts';
import { GitTagsDatasource } from '../git-tags/index.ts';

import { publicGoproxyUrl } from './env.ts';
import { parseGoproxy, parseNoproxy } from './goproxy-parser.ts';
import { getGoTagDatasource } from './tag-datasources.ts';
import type { DataSource, GoproxyItem } from './types.ts';

/**
 * Whether a module's data may be written to a package cache which is shared with others.
 *
 * `GOPRIVATE`/`GONOPROXY` is how the user declares which modules are private, and `GOPROXY` decides who serves the rest: whatever the public proxy serves is public by definition, whereas a self-hosted proxy may serve modules which are not.
 *
 * `direct` only counts as public alongside the public proxy, which is how Go's own default `GOPROXY` is written: there, it is the fallback for what the public proxy doesn't have. On its own it means every module comes from its source, which tells us nothing about who may read it.
 *
 * An unset `GOPROXY` is the default, so it is public too.
 *
 * A `hostType: go` (or `go-proxy`) host rule with credentials for the module's host is also a declaration that the module is private, as it can't be read without them.
 *
 * @see https://go.dev/ref/mod#private-modules
 */
function isPublicProxy({ url }: GoproxyItem): boolean {
  return trimTrailingSlash(url) === publicGoproxyUrl;
}

function matchesRuleHost(rule: HostRule, url: string): boolean {
  return !rule.matchHost || hostRules.matchesHost(url, rule.matchHost);
}

function hasGoHostRuleCredentials(packageName: string): boolean {
  const url = `https://${packageName}`;
  return [
    ...hostRules.findAll({ hostType: 'go' }),
    ...hostRules.findAll({ hostType: 'go-proxy' }),
  ].some(
    (rule) =>
      matchesRuleHost(rule, url) &&
      [rule.token, rule.password, rule.httpsPrivateKey].some(isNonEmptyString),
  );
}

export function isPublicGoPackage(packageName: string): boolean {
  if (parseNoproxy()?.test(packageName)) {
    return false;
  }

  if (hasGoHostRuleCredentials(packageName)) {
    return false;
  }

  const proxies = parseGoproxy();

  return proxies.every((proxy) => {
    if (proxy.url === 'off' || isPublicProxy(proxy)) {
      return true;
    }
    return proxy.url === 'direct' && proxies.some(isPublicProxy);
  });
}

export async function getSourceUrl(
  dataSource?: DataSource | null,
): Promise<string | undefined> {
  if (!dataSource) {
    return undefined;
  }

  const { datasource, registryUrl, packageName } = dataSource;
  const tagDatasource = await getGoTagDatasource(datasource);
  if (!tagDatasource || tagDatasource instanceof GitTagsDatasource) {
    return undefined;
  }

  return tagDatasource.getSourceUrl(packageName, registryUrl);
}
