import dns from 'node:dns';
import dnsPromises from 'node:dns/promises';
import net from 'node:net';
import { isString } from '@sindresorhus/is';
import type {
  BeforeRedirectHook,
  BeforeRequestHook,
  NormalizedOptions,
  PlainResponse,
} from 'got';
import { GlobalConfig } from '../../config/global.ts';
import { HOST_BLOCKED } from '../../constants/error-messages.ts';
import { logger } from '../../logger/index.ts';
import { hasProxy } from '../../proxy.ts';
import type { InternalHostGrant } from '../../types/index.ts';
import * as hostRules from '../host-rules.ts';
import { coerceObject } from '../object.ts';
import { regEx } from '../regex.ts';
import { parseUrl } from '../url.ts';

/** Why a host must not be requested. */
export type BlockedHostCategory =
  /** loopback, RFC1918, link-local, and other special-use addresses that are never routable on the public Internet */
  | 'internal'
  /** Cloud provider instance-metadata services (IMDS and equivalents), which can potentially hand out credentials to anything that can reach them, and should never be accessible from an HTTP request from Renovate, regardless of any self-hosted administrator allowlisting */
  | 'metadata';

/**
 * Instance-metadata hostnames, blocked regardless of what they resolve to.
 *
 * Only names which serve nothing but metadata belong here: a name in this set can never be permitted, whatever the configuration says. Providers whose metadata service is only reachable by IP (AWS, Azure, ...) are covered by {@link metadataBlockList} instead.
 */
const metadataHostnames = new Set([
  'metadata.google.internal',
  // Equinix Metal (formerly Packet)
  'metadata.packet.net',
]);

// `BlockList.check()` classifies IPv4-mapped IPv6 addresses (in dotted-quad, hexadecimal, and uncompressed spellings) against IPv4 rules, so e.g. `::ffff:169.254.169.254` matches `169.254.169.254` without any normalization on our side.
const metadataBlockList = new net.BlockList();
// AWS/GCP/Azure/... IMDS
metadataBlockList.addAddress('169.254.169.254', 'ipv4');
// AWS IMDS IPv6 endpoint
metadataBlockList.addAddress('fd00:ec2::254', 'ipv6');
// AWS ECS task credentials endpoint
metadataBlockList.addAddress('169.254.170.2', 'ipv4');
// AWS EKS Pod Identity endpoint
metadataBlockList.addAddress('169.254.170.23', 'ipv4');
// Alibaba Cloud/Tencent Cloud metadata
metadataBlockList.addAddress('100.100.100.200', 'ipv4');

const internalBlockList = new net.BlockList();
// "this network" (routes to localhost on Linux)
internalBlockList.addSubnet('0.0.0.0', 8, 'ipv4');
// RFC1918 private ranges
internalBlockList.addSubnet('10.0.0.0', 8, 'ipv4');
internalBlockList.addSubnet('172.16.0.0', 12, 'ipv4');
internalBlockList.addSubnet('192.168.0.0', 16, 'ipv4');
// carrier-grade NAT
internalBlockList.addSubnet('100.64.0.0', 10, 'ipv4');
// loopback
internalBlockList.addSubnet('127.0.0.0', 8, 'ipv4');
// link-local, including the cloud metadata endpoints
internalBlockList.addSubnet('169.254.0.0', 16, 'ipv4');
// multicast
internalBlockList.addSubnet('224.0.0.0', 4, 'ipv4');
// IPv6 unspecified and loopback
internalBlockList.addAddress('::', 'ipv6');
internalBlockList.addAddress('::1', 'ipv6');
// IPv6 unique-local
internalBlockList.addSubnet('fc00::', 7, 'ipv6');
// IPv6 link-local
internalBlockList.addSubnet('fe80::', 10, 'ipv6');

/**
 * Classifies an IP address, returning the category it is blocked under, or `null` for a public address.
 *
 * A string that is not a valid IP address is classified as `internal` - we should fail closed instead of possibly connecting to something we shouldn't be.
 */
export function classifyIpAddress(address: string): BlockedHostCategory | null {
  const version = net.isIP(address);
  if (version === 0) {
    return 'internal';
  }

  const family = version === 4 ? 'ipv4' : 'ipv6';

  if (metadataBlockList.check(address, family)) {
    return 'metadata';
  }

  if (internalBlockList.check(address, family)) {
    return 'internal';
  }

  return null;
}

/**
 * Classifies a hostname against the metadata-endpoint hostname list.
 *
 * Only metadata hostnames can be classified without DNS resolution - any other hostname needs its resolved addresses checked via {@link classifyIpAddress}.
 */
export function classifyHostname(hostname: string): BlockedHostCategory | null {
  // handle trailing-dot FQDN forms like `metadata.google.internal.`
  const normalized = hostname.toLowerCase().replace(regEx(/\.$/), '');
  if (metadataHostnames.has(normalized)) {
    return 'metadata';
  }
  return null;
}

/** Strips the brackets `URL` keeps around IPv6 hosts, leaving other hosts as they are. */
function unbracketHostname(hostname: string): string {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

/**
 * Classifies a URL from its host alone: IP-literal hosts are classified by address, and metadata hostnames by name.
 *
 * Returns `null` when nothing can be decided at the URL level - i.e. the host is a regular hostname, whose resolved addresses must be checked via {@link classifyIpAddress} at DNS lookup time.
 */
export function classifyUrl(url: URL): BlockedHostCategory | null {
  const hostname = unbracketHostname(url.hostname);

  if (net.isIP(hostname) !== 0) {
    return classifyIpAddress(hostname);
  }

  return classifyHostname(hostname);
}

/**
 * What the URL-level check decided for a request, and so how the addresses its host resolves to must be treated.
 */
export type HostGuardDecision =
  /** internal addresses are permitted for this request, and only metadata addresses need blocking at resolution time */
  | 'granted'
  /** every address the host resolves to must be validated at DNS lookup time, with internal ones blocking the request */
  | 'check-dns'
  /** as `check-dns`, but an internal address only warns - the `internalHostAccess=warn` default lets the request through */
  | 'warn-dns';

interface BlockedAddress {
  address: string;
  category: BlockedHostCategory;
}

/**
 * Returns the resolved address which decides the outcome for a hostname, or `null` when every one of them is a public address.
 *
 * Each resolved record is a potential connection target, so each must pass. A metadata address decides the outcome over an internal one, as it is blocked in every mode.
 */
function findBlockedAddress(addresses: string[]): BlockedAddress | null {
  let internal: BlockedAddress | null = null;
  for (const address of addresses) {
    const category = classifyIpAddress(address);
    if (category === 'metadata') {
      return { address, category };
    }
    if (category === 'internal') {
      internal ??= { address, category };
    }
  }
  return internal;
}

/**
 * Applies `decision` to the addresses a hostname resolved to, logging the outcome, and returning `true` when the request must not be made.
 */
function isResolutionBlocked(
  hostname: string,
  addresses: string[],
  decision: HostGuardDecision,
  hostType: string | undefined,
  responseBecomesConfig: boolean | undefined,
): boolean {
  const blocked = findBlockedAddress(addresses);
  if (!blocked) {
    return false;
  }

  if (blocked.category === 'internal') {
    if (decision === 'granted') {
      return false;
    }
    if (decision === 'warn-dns') {
      warnInternalHost(hostname, hostType, responseBecomesConfig);
      return false;
    }
  }

  logger.warn(
    { hostname, address: blocked.address },
    'Blocked HTTP request: hostname resolves to a blocked address',
  );
  return true;
}

/**
 * Validates every address a hostname resolves to, on every connection, which also catches a host whose answer changes between checks (DNS rebinding).
 *
 * The guard is built per request, as the policy it enforces is read from the configuration when the request is made.
 */
function makeGuardedLookup(
  decision: HostGuardDecision,
  hostType: string | undefined,
  responseBecomesConfig: boolean | undefined,
): typeof dns.lookup {
  return function guardedLookup(
    hostname: string,
    options: dns.LookupOptions,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | dns.LookupAddress[],
      family?: number,
    ) => void,
  ): void {
    dns.lookup(hostname, options, (err, address, family) => {
      if (err) {
        callback(err, address, family);
        return;
      }

      // with `options.all`, the result is an array of every record
      const addresses = isString(address)
        ? [address]
        : address.map((entry) => entry.address);
      if (
        isResolutionBlocked(
          hostname,
          addresses,
          decision,
          hostType,
          responseBecomesConfig,
        )
      ) {
        callback(new Error(HOST_BLOCKED), address, family);
        return;
      }

      callback(err, address, family);
    });
    // `dns.lookup` is an overloaded function, so the single signature implemented here is not assignable to it without a cast - got only ever calls the `(hostname, options, callback)` overload
  } as typeof dns.lookup;
}

function isPlatformEndpoint(url: URL): boolean {
  const endpoint = GlobalConfig.get('endpoint');
  if (!endpoint) {
    return false;
  }
  // the whole origin must match: another port or scheme on the platform's host is a different service, which the administrator has not vouched for
  return parseUrl(endpoint)?.origin === url.origin;
}

/**
 * Whether the administrator has permitted internal access for this request, leaving aside the `internalHostAccess` mode: a permitted request neither blocks nor warns, whatever the mode is.
 */
function isInternalGranted(
  url: URL,
  grant: InternalHostGrant | undefined,
  responseBecomesConfig: boolean | undefined,
): boolean {
  // without its platform, Renovate cannot run at all - the endpoint is the administrator's own choice of host
  if (isPlatformEndpoint(url)) {
    return true;
  }

  // a response which becomes configuration can redirect Renovate at anything, so the administrator must have named this host for this purpose, not merely named it
  if (responseBecomesConfig) {
    return grant?.scoped === true;
  }

  return grant?.explicit ?? grant?.implicit ?? false;
}

/**
 * Warns about a request which `internalHostAccess=block` would refuse, once per host, naming the grant which would permit it.
 */
function warnInternalHost(
  hostname: string,
  hostType: string | undefined,
  responseBecomesConfig: boolean | undefined,
): void {
  // a response which becomes config needs the deliberately-scoped grant, so pointing at a plain host rule would be misleading advice
  if (responseBecomesConfig) {
    logger.once.warn(
      { hostname, hostType },
      'HTTP request to an internal host whose response becomes configuration, which `internalHostAccess=block` would refuse - permit it with a `hostRules` entry setting `allowInternal: true`, scoped with a `hostType` or a URL-prefix `matchHost`, or set `internalHostAccess=block` to enforce this now. The default will become `block` in a future major release.',
    );
    return;
  }

  logger.once.warn(
    { hostname, hostType },
    'HTTP request to an internal host, which `internalHostAccess=block` would refuse - permit it with a `hostRules` entry naming the host, or one setting `allowInternal: true`, or set `internalHostAccess=block` to enforce this now. The default will become `block` in a future major release.',
  );
}

/**
 * Enforce the internal-host policy on a request URL, throwing `HOST_BLOCKED` when the request must not be made.
 *
 * Metadata endpoints are blocked no matter what the configuration says: Renovate's HTTP layer never has a legitimate reason to request them.
 */
export function checkUrl(
  url: URL,
  hostType: string | undefined,
  grant: InternalHostGrant | undefined,
  responseBecomesConfig?: boolean,
): HostGuardDecision {
  const category = classifyUrl(url);
  if (category === 'metadata') {
    logger.warn(
      { url: url.href, hostType },
      'Blocked HTTP request to a cloud instance-metadata endpoint',
    );
    throw new Error(HOST_BLOCKED);
  }

  const mode = GlobalConfig.get('internalHostAccess');
  if (
    mode === 'allow' ||
    isInternalGranted(url, grant, responseBecomesConfig)
  ) {
    if (category === 'internal') {
      logger.once.info(
        `Internal host ${url.hostname} permitted by configuration`,
      );
    }
    return 'granted';
  }

  // `warn` reports what `block` would refuse, without refusing it, so that administrators can add the grants they need before the default changes
  if (mode === 'warn') {
    if (category === 'internal') {
      warnInternalHost(url.hostname, hostType, responseBecomesConfig);
    }
    return 'warn-dns';
  }

  if (category === 'internal') {
    logger.warn(
      { url: url.href, hostType },
      'Blocked HTTP request to an internal host - a self-hosted administrator can permit it via `hostRules`, or with `internalHostAccess=allow`',
    );
    throw new Error(HOST_BLOCKED);
  }
  return 'check-dns';
}

/**
 * Validates what a request's hostname resolves to, before the request is made, for deployments where `dnsLookup` cannot do it.
 *
 * A proxy agent connects to the proxy and hands it the target hostname, so the target is resolved by the proxy and Renovate's `dnsLookup` guard never runs. Resolving here instead is best-effort only: the proxy re-resolves the hostname itself, so a DNS-rebinding or split-horizon answer can still differ from what we saw. Pair it with egress controls on the proxy.
 */
async function preflightHostname(
  url: URL,
  decision: HostGuardDecision,
  hostType: string | undefined,
  responseBecomesConfig: boolean | undefined,
): Promise<void> {
  const hostname = unbracketHostname(url.hostname);
  if (net.isIP(hostname) !== 0) {
    // an IP-literal host needs no resolution - `checkUrl` has already classified it
    return;
  }

  let addresses: dns.LookupAddress[];
  try {
    addresses = await dnsPromises.lookup(hostname, { all: true });
  } catch {
    // fail open: a locked-down proxy environment often has no resolver which can answer for public names at all, and failing closed would break every such deployment
    logger.once.debug(
      `Host guard could not resolve ${hostname} - relying on the proxy for this request`,
    );
    return;
  }

  if (
    isResolutionBlocked(
      hostname,
      addresses.map((entry) => entry.address),
      decision,
      hostType,
      responseBecomesConfig,
    )
  ) {
    throw new Error(HOST_BLOCKED);
  }
}

function makeBeforeRequest(
  hostType: string | undefined,
  responseBecomesConfig: boolean | undefined,
): BeforeRequestHook {
  return async function hostGuardBeforeRequest(
    options: NormalizedOptions,
  ): Promise<void> {
    const url = options.url instanceof URL ? options.url : null;
    if (!url) {
      // fail closed: without a parsed target there is nothing to validate
      throw new Error(HOST_BLOCKED);
    }

    // got runs this hook again for every redirect target, so the decision is re-made for whatever host is about to be requested rather than carried over
    const grant = hostRules.find({
      hostType,
      url: url.toString(),
    }).internalHostGrant;
    await preflightHostname(
      url,
      checkUrl(url, hostType, grant, responseBecomesConfig),
      hostType,
      responseBecomesConfig,
    );
  };
}

/**
 * Removes the credentials belonging to the host a request is being redirected away from, so that a redirect cannot hand them to another origin.
 *
 * got strips the credentials it knows about itself - `authorization`, `cookie` and any URL userinfo - before this hook runs, and treats a scheme downgrade as a different origin, so an `https:` to `http:` redirect is covered. What it does not know about survives: the `Private-token` header GitLab personal access tokens are sent in (see `applyAuthorization`), and any credential an administrator configured through a `hostRules` `headers` entry.
 *
 * Those headers are dropped rather than replaced with the target host's own: `hostRules` headers are resolved once, when the request is built, so there is nothing to re-apply here. Sending none is the safe outcome.
 */
function stripCrossOriginCredentials(
  options: NormalizedOptions,
  fromUrl: URL | null,
  toUrl: URL,
  hostType: string | undefined,
): void {
  if (fromUrl?.origin === toUrl.origin) {
    // the credentials are still going to the host they were configured for
    return;
  }

  // an unparseable source URL is treated as cross-origin: it cannot be shown to be the same origin, so nothing is carried over
  if (fromUrl) {
    const configured = hostRules.find({
      hostType,
      url: fromUrl.toString(),
    }).headers;
    for (const name of Object.keys(coerceObject(configured))) {
      // got normalizes header names to lower case
      delete options.headers[name.toLowerCase()];
    }
  }

  // defence in depth: got has removed these already, but they must never reach another origin
  delete options.headers.authorization;
  delete options.headers.cookie;
  delete options.headers['private-token'];
}

function makeBeforeRedirect(
  hostType: string | undefined,
  responseBecomesConfig: boolean | undefined,
): BeforeRedirectHook {
  return function hostGuardBeforeRedirect(
    options: NormalizedOptions,
    response: PlainResponse,
  ): void {
    const url = options.url instanceof URL ? options.url : null;
    if (!url) {
      // fail closed: without a parsed target there is nothing to validate
      throw new Error(HOST_BLOCKED);
    }

    const fromUrl = isString(response.url) ? parseUrl(response.url) : null;
    stripCrossOriginCredentials(options, fromUrl, url, hostType);

    // the original host's verdict must not carry over: the new host gets its own grant lookup and decision
    const grant = hostRules.find({
      hostType,
      url: url.toString(),
    }).internalHostGrant;
    // a redirect target of a config-fetching request is still config-fetching, so the flag carries over even though the verdict does not
    options.dnsLookup = makeGuardedLookup(
      checkUrl(url, hostType, grant, responseBecomesConfig),
      hostType,
      responseBecomesConfig,
    );
  };
}

export interface HostGuard {
  dnsLookup: typeof dns.lookup;
  beforeRedirect: BeforeRedirectHook;
  /** Only set when a proxy is configured, which makes `dnsLookup` inert. */
  beforeRequest?: BeforeRequestHook;
}

/**
 * Enforce the internal-host policy for a request to `url`, throwing `HOST_BLOCKED` when the request must not be made at all.
 *
 * The returned got options carry the policy through the rest of the request's lifetime: `dnsLookup` validates what hostnames resolve to (on every connection, which also covers DNS rebinding), and `beforeRedirect` re-runs this check for every redirect target.
 *
 * When a proxy is configured, the proxy agent resolves the target hostname itself and `dnsLookup` is never called, so a `beforeRequest` hook resolves and validates the hostname up front instead - see {@link preflightHostname} for what that can and cannot catch.
 *
 * `responseBecomesConfig` marks a request whose response is interpreted as Renovate configuration, which an internal host may only serve under a deliberately-scoped `allowInternal` grant.
 *
 * Under the `internalHostAccess=warn` default, an internal host which no grant permits is logged rather than blocked, so that administrators can add the grants they need before the default becomes `block`.
 */
export function applyHostGuard(
  url: URL,
  hostType: string | undefined,
  grant: InternalHostGrant | undefined,
  responseBecomesConfig?: boolean,
): HostGuard {
  const decision = checkUrl(url, hostType, grant, responseBecomesConfig);
  const guard: HostGuard = {
    dnsLookup: makeGuardedLookup(decision, hostType, responseBecomesConfig),
    beforeRedirect: makeBeforeRedirect(hostType, responseBecomesConfig),
  };

  if (hasProxy()) {
    guard.beforeRequest = makeBeforeRequest(hostType, responseBecomesConfig);
  }

  return guard;
}
