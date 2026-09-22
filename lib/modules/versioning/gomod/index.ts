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
export function isPseudoVersion(version: string): boolean {
  return semver.isVersion(version) && pseudoVersionRegex.test(version);
}

/**
 * Whether the version is a `v0.0.0-` pseudo-version, which Go uses for a module
 * without any release tag, such as `v0.0.0-20191109021931-daa7c04131f5`.
 */
export function isUntaggedPseudoVersion(version: string | undefined): boolean {
  return !!version?.startsWith('v0.0.0-') && isPseudoVersion(version);
}

export const api: VersioningApi = { ...semver };

export default api;
