import { regEx } from '../../../util/regex.ts';
import { api as semver } from '../semver/index.ts';
import type { VersioningApi } from '../types.ts';

export const id = 'gomod';
export const displayName = 'Go Modules';
export const urls = [
  '[Go Modules Reference: Versions](https://go.dev/ref/mod#versions)',
];
export const supportsRanges = false;

// Same pattern as `IsPseudoVersion()` in golang.org/x/mod/module
const pseudoVersionRegex = regEx(
  /^v\d+\.(?:0\.0-|\d+\.\d+-(?:[^+]*\.)?0\.)\d{14}-[A-Za-z0-9]+(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
);

/**
 * Whether the version is a pseudo-version, which Go uses to refer to a commit
 * instead of a tagged release, in any of its three forms:
 * `vX.0.0-yyyymmddhhmmss-abcdefabcdef` without a base version,
 * `vX.Y.Z-pre.0.yyyymmddhhmmss-abcdefabcdef` after a pre-release and
 * `vX.Y.(Z+1)-0.yyyymmddhhmmss-abcdefabcdef` after a release.
 *
 * @see https://go.dev/ref/mod#pseudo-versions
 */
export function isPseudoVersion(version: string | undefined): boolean {
  return (
    !!version && semver.isVersion(version) && pseudoVersionRegex.test(version)
  );
}

export const api: VersioningApi = { ...semver };

export default api;
