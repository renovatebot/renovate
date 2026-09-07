import net from 'node:net';
import { regEx } from '../regex.ts';

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

/**
 * Classifies a URL from its host alone: IP-literal hosts are classified by address, and metadata hostnames by name.
 *
 * Returns `null` when nothing can be decided at the URL level - i.e. the host is a regular hostname, whose resolved addresses must be checked via {@link classifyIpAddress} at DNS lookup time.
 */
export function classifyUrl(url: URL): BlockedHostCategory | null {
  let { hostname } = url;

  // URL keeps IPv6 hosts in bracketed form
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }

  if (net.isIP(hostname) !== 0) {
    return classifyIpAddress(hostname);
  }

  return classifyHostname(hostname);
}
