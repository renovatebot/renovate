import { regEx } from '../../../util/regex.ts';

export interface ParsedManifestUrl {
  date: string;
  version: string;
}

/**
 * Parse a Rust manifest URL to extract the release date and version identifier.
 *
 * Supports the format: .../YYYY-MM-DD/channel-rust-{identifier}.toml
 *
 * @param url - The manifest URL to parse
 * @returns Parsed manifest data, or null if the URL is invalid
 *
 * @example
 * parseManifestUrl('static.rust-lang.org/dist/2025-11-24/channel-rust-nightly.toml')
 * // { date: '2025-11-24', version: 'nightly' }
 *
 * parseManifestUrl('static.rust-lang.org/dist/2024-10-17/channel-rust-1.82.0.toml')
 * // { date: '2024-10-17', version: '1.82.0' }
 *
 * parseManifestUrl('invalid-url')
 * // null
 */
export function parseManifestUrl(url: string): ParsedManifestUrl | null {
  // Permissive regex to extract date and version from manifest URLs
  // Matches: .../YYYY-MM-DD/channel-rust-{identifier}.toml
  const pattern = regEx(
    /(?<date>\d{4}-\d{2}-\d{2})\/channel-rust-(?<version>.+?)\.toml$/,
  );

  const match = pattern.exec(url);
  if (!match?.groups) {
    return null;
  }

  const { date, version } = match.groups;

  return { date, version };
}
