import { isNonEmptyString, isObject } from '@sindresorhus/is';
import type { NewValueConfig, VersioningApi } from '../types.ts';
import { parse } from './parse.ts';
import { sortParsed } from './util.ts';

export const id = 'rust-release-channel';
export const displayName = 'Rust Release Channel';
export const urls = [
  'https://rust-lang.github.io/rustup/concepts/toolchains.html',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['pin', 'replace'];

/** Rust 1.0.0 release date for major version calculation */
const rust1Date = new Date('2015-05-15');

class RustReleaseChannelVersioning implements VersioningApi {
  isValid(input: string): boolean {
    return parse(input) !== null;
  }

  isVersion(input: string | undefined | null): boolean {
    if (!isNonEmptyString(input)) {
      return false;
    }

    const parsed = parse(input);
    if (!parsed) {
      return false;
    }

    const { channel, date } = parsed;

    // Support dated nightly versions like `nightly-2025-11-24`
    if (channel === 'nightly') {
      return date !== undefined;
    }

    // Support versioned channels like `1.82.0` or `1.83.0-beta.5`
    if (isObject(channel)) {
      // Without patch, it's a range
      if (channel.patch === undefined) {
        return false;
      }

      // With beta without number, it's a range
      return !channel.prerelease || channel.prerelease.number !== undefined;
    }

    return false;
  }

  isSingleVersion(input: string): boolean {
    return this.isVersion(input);
  }

  isStable(version: string): boolean {
    const parsed = parse(version);
    if (!parsed) {
      return false;
    }

    const { channel } = parsed;

    // Channel names and ranges are not stable
    if (!isObject(channel)) {
      return false;
    }

    // Version without patch is a range
    if (channel.patch === undefined) {
      return false;
    }

    // Version with prerelease is not stable
    return !channel.prerelease;
  }

  isCompatible(version: string, current?: string): boolean {
    if (!current) {
      return true;
    }

    const parsedVersion = parse(version);
    const parsedCurrent = parse(current);
    if (!parsedVersion || !parsedCurrent) {
      return false;
    }

    // Host triples must match (both undefined, or both the same value)
    if (parsedVersion.host !== parsedCurrent.host) {
      return false;
    }

    const channelVersion = parsedVersion.channel;
    const channelCurrent = parsedCurrent.channel;

    // Nightly versions are compatible only with other nightlies
    // Stable and beta versions are compatible with each other

    const isVersionNightly = channelVersion === 'nightly';
    const isCurrentNightly = channelCurrent === 'nightly';

    return isVersionNightly === isCurrentNightly;
  }

  getMajor(version: string): number | null {
    const parsed = parse(version);
    if (!parsed) {
      return null;
    }

    const { channel, date } = parsed;

    // Nightly with date
    if (channel === 'nightly' && date) {
      const versionDate = new Date(date.year, date.month - 1, date.day);
      return versionDate >= rust1Date ? 1 : 0;
    }

    // Version object
    if (isObject(channel)) {
      return channel.major;
    }

    // Default to major version 1 otherwise
    return 1;
  }

  getMinor(version: string): number | null {
    const parsed = parse(version);
    if (!parsed) {
      return null;
    }

    const { channel } = parsed;

    // Only version objects have minor
    if (isObject(channel)) {
      return channel.minor;
    }

    return null;
  }

  getPatch(version: string): number | null {
    const parsed = parse(version);
    if (!parsed) {
      return null;
    }

    const { channel } = parsed;

    // Only version objects have patch
    if (isObject(channel)) {
      return channel.patch ?? null;
    }

    return null;
  }

  sortVersions(version: string, other: string): number {
    const parsedA = parse(version);
    const parsedB = parse(other);

    if (!parsedA || !parsedB) {
      return version.localeCompare(other);
    }

    return sortParsed(parsedA, parsedB);
  }

  equals(version: string, other: string): boolean {
    const parsedA = parse(version);
    const parsedB = parse(other);

    if (!parsedA || !parsedB) {
      return false;
    }

    return sortParsed(parsedA, parsedB) === 0;
  }

  isGreaterThan(version: string, other: string): boolean {
    return this.sortVersions(version, other) > 0;
  }

  getSatisfyingVersion(versions: string[], range: string): string | null {
    const matching = versions.filter((version) => this.matches(version, range));
    if (matching.length === 0) {
      return null;
    }

    // Sort and return the highest (last in sorted array)
    matching.sort((a, b) => this.sortVersions(a, b));
    return matching.slice(-1)[0];
  }

  minSatisfyingVersion(versions: string[], range: string): string | null {
    const matching = versions.filter((version) => this.matches(version, range));
    if (matching.length === 0) {
      return null;
    }

    // Sort and return the lowest (first in sorted array)
    matching.sort((a, b) => this.sortVersions(a, b));
    return matching[0];
  }

  getNewValue({
    currentValue,
    rangeStrategy,
    newVersion,
  }: NewValueConfig): string | null {
    const parsedCurrent = parse(currentValue);
    const parsedNew = parse(newVersion);

    if (!parsedCurrent || !parsedNew) {
      return null;
    }

    const currentChannel = parsedCurrent.channel;
    const newChannel = parsedNew.channel;

    // Pin strategy: always return exact newVersion
    if (rangeStrategy === 'pin') {
      return newVersion;
    }

    // Dated nightlies should be replaced with new dated nightly
    if (currentChannel === 'nightly' && parsedCurrent.date) {
      return newVersion;
    }

    // Channel names (without dates) stay as channel names
    if (!isObject(currentChannel)) {
      return currentValue;
    }

    if (isObject(newChannel)) {
      // If current had no patch, new shouldn't either (range style)
      if (currentChannel.patch === undefined) {
        return `${newChannel.major}.${newChannel.minor}`;
      }

      // If current had prerelease without number (beta range), create beta range
      if (
        currentChannel.prerelease &&
        currentChannel.prerelease.number === undefined
      ) {
        return `${newChannel.major}.${newChannel.minor}.${newChannel.patch ?? 0}-beta`;
      }
    }

    return newVersion;
  }

  matches(version: string, range: string): boolean {
    const parsedVersion = parse(version);
    const parsedRange = parse(range);

    if (!parsedVersion || !parsedRange) {
      return false;
    }

    const versionChannel = parsedVersion.channel;
    const rangeChannel = parsedRange.channel;

    // For 'nightly' range, version must be a dated nightly
    if (rangeChannel === 'nightly') {
      return versionChannel === 'nightly' && parsedVersion.date !== undefined;
    }

    // For 'beta' range, version must be a beta version
    if (rangeChannel === 'beta') {
      return (
        isObject(versionChannel) && versionChannel.prerelease?.name === 'beta'
      );
    }

    // For 'stable' range, version must be a final release
    if (rangeChannel === 'stable') {
      return (
        isObject(versionChannel) &&
        versionChannel.patch !== undefined &&
        !versionChannel.prerelease
      );
    }

    // Handle version range matching
    if (isObject(rangeChannel) && isObject(versionChannel)) {
      // Major and minor must match
      if (
        versionChannel.major !== rangeChannel.major ||
        versionChannel.minor !== rangeChannel.minor
      ) {
        return false;
      }

      // If range has no patch, it's a range (e.g., "1.82" matches "1.82.0", "1.82.1", etc.)
      if (rangeChannel.patch === undefined) {
        return true;
      }

      // Patch must match
      if (versionChannel.patch !== rangeChannel.patch) {
        return false;
      }

      // If range has no prerelease, version must also have no prerelease
      if (!rangeChannel.prerelease) {
        return !versionChannel.prerelease;
      }

      // If range has prerelease but no number, it's a range (e.g., "1.83.0-beta" matches all beta versions)
      if (rangeChannel.prerelease.number === undefined) {
        return !!versionChannel.prerelease;
      }

      // Both have prerelease with numbers, they must match exactly
      return (
        !!versionChannel.prerelease &&
        versionChannel.prerelease?.number === rangeChannel.prerelease.number
      );
    }

    return false;
  }
}

export const api = new RustReleaseChannelVersioning();

export default api;
