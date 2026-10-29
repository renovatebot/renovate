import { isNonEmptyString } from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global.ts';
import type { HostRule } from '../../../types/index.ts';
import { getEnv } from '../../../util/env.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { parseUrl, trimTrailingSlash } from '../../../util/url.ts';
import type { GoEnv } from './types.ts';

/**
 * The Go module proxy which serves public modules only, and which the Go toolchain uses by default.
 *
 * @see https://go.dev/ref/mod#module-proxy
 */
export const publicGoproxyUrl = 'https://proxy.golang.org';

function toUrl(matchHost: string | undefined): URL | null {
  // a leading dot matches any subdomain, so it can't be turned into one host
  if (!isNonEmptyString(matchHost) || matchHost.startsWith('.')) {
    return null;
  }
  return parseUrl(
    matchHost.includes('://') ? matchHost : `https://${matchHost}`,
  );
}

function toGoproxyUrl(rule: HostRule, withCredentials: boolean): string | null {
  const url = toUrl(rule.matchHost);
  if (!url) {
    return null;
  }

  // `go` only sends basic auth from a `GOPROXY` URL, so a token-only rule can't be embedded
  if (
    withCredentials &&
    isNonEmptyString(rule.username) &&
    isNonEmptyString(rule.password)
  ) {
    url.username = encodeURIComponent(rule.username);
    url.password = encodeURIComponent(rule.password);
  }

  return trimTrailingSlash(url.href);
}

/**
 * Returns the module path pattern of a `hostType: go` rule whose `matchHost` includes a path, e.g. `https://github.com/org` → `github.com/org`.
 */
function toPrivateModulePattern(rule: HostRule): string | null {
  const url = toUrl(rule.matchHost);
  const path = trimTrailingSlash(url?.pathname ?? '');
  if (!url || !path) {
    return null;
  }
  return `${url.hostname}${path}`;
}

function joinNonEmpty(values: (string | null)[]): string | undefined {
  const list = new Set(values.filter(isNonEmptyString));
  return list.size ? [...list].join(',') : undefined;
}

/**
 * Returns the `GOPROXY`, `GONOPROXY`, `GOPRIVATE` and `GONOSUMDB` values to use.
 *
 * Each value set in the environment is used as-is.
 * With `goEnvFromHostRules` enabled, unset values are derived from host rules:
 * - `GOPROXY`: one URL per `hostType: go-proxy` rule, followed by the public proxy and `direct`
 * - `GONOPROXY`: `hostType: go` rules whose `matchHost` includes a path
 * - `GONOSUMDB`: the `go-proxy` hosts and the `GONOPROXY` patterns
 *
 * `GONOPROXY` and `GONOSUMDB` aren't derived when `GOPRIVATE` is set, as they would override it.
 *
 * @param withCredentials embed `go-proxy` rule credentials in the derived `GOPROXY`, for running `go`
 */
export function getGoEnv(withCredentials = false): GoEnv {
  const { GOPROXY, GONOPROXY, GOPRIVATE, GONOSUMDB } = getEnv();
  const env: GoEnv = { GOPROXY, GONOPROXY, GOPRIVATE, GONOSUMDB };

  if (!GlobalConfig.get('goEnvFromHostRules')) {
    return env;
  }

  const proxyRules = hostRules.findAll({ hostType: 'go-proxy' });

  if (GOPROXY === undefined) {
    const proxies = joinNonEmpty(
      proxyRules.map((rule) => toGoproxyUrl(rule, withCredentials)),
    );
    if (proxies) {
      env.GOPROXY = `${proxies},${publicGoproxyUrl},direct`;
    }
  }

  if (GOPRIVATE !== undefined) {
    return env;
  }

  const privatePatterns = hostRules
    .findAll({ hostType: 'go' })
    .map(toPrivateModulePattern);

  env.GONOPROXY ??= joinNonEmpty(privatePatterns);
  env.GONOSUMDB ??= joinNonEmpty([
    ...proxyRules.map((rule) => toUrl(rule.matchHost)?.hostname ?? null),
    ...privatePatterns,
  ]);

  return env;
}
