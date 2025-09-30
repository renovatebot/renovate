/**
 * Represents the structure of a package extracted from an APK index file.
 *
 * An APK index file contains package metadata in a specific format where each
 * package entry is separated by a blank line and contains key-value pairs
 * separated by colons. The format follows the Alpine Linux APK specification:
 *
 * ```
 * P:package-name
 * V:version
 * U:url
 * t:build-timestamp
 * ```
 *
 * @example
 *
 * ```
 * P:nginx
 * V:1.28.0-r3
 * U:https://www.nginx.org/
 * t:1747894670
 *
 * P:bash
 * V:5.3-r1
 * t:1752770415
 * ```
 *
 * Only fields that are actually used downstream are included in this interface.
 * Many APK index fields (arch, size, description, license, maintainer, etc.)
 * are parsed but not stored to reduce complexity and memory usage since they
 * are not needed for Renovate's version checking functionality.
 */
export interface ApkPackage {
  /** Package name (required) - used for filtering packages by name */
  name: string;
  /** Package version (required) - used for creating release objects */
  version: string;
  /** Package homepage URL (optional) - used for homepage in ReleaseResult */
  url?: string;
  /** Build timestamp as Unix timestamp (optional) - used for releaseTimestamp conversion */
  buildDate?: number;
}
