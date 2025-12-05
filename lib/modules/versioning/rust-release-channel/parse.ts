import type { ToolchainObject, VersionObject } from './types';

/**
 * Parse a Rust toolchain string into a structured object.
 *
 * Supports the format: <channel>[-<date>][-<host>]
 *
 * @param input - The toolchain string to parse
 * @returns Parsed toolchain object, or null if the input is invalid
 *
 * @example
 * parse('stable') // { channel: 'stable' }
 * parse('1.82.0') // { channel: { major: 1, minor: 82, patch: 0 } }
 * parse('nightly-2025-11-24') // { channel: 'nightly', date: { year: 2025, month: 11, day: 24 } }
 * parse('invalid') // null
 */
export function parse(input: string): ToolchainObject | null {
  if (!input) {
    return null;
  }

  // Format: <channel>[-<date>][-<host>]
  // Single regex to parse the entire spec
  const regex =
    /^(stable|beta|nightly|(\d+)\.(\d+)(?:\.(\d+))?(?:-(beta)(?:\.(\d+))?)?)(?:-(\d{4})-(\d{2})-(\d{2}))?(?:-(.+))?$/;

  const match = regex.exec(input);
  if (!match) {
    return null;
  }

  const channelStr = match[1];
  const major = match[2];
  const minor = match[3];
  const patch = match[4];
  const beta = match[5];
  const betaNumber = match[6];
  const year = match[7];
  const month = match[8];
  const day = match[9];
  const host = match[10];

  let channel: 'stable' | 'beta' | 'nightly' | VersionObject;
  if (
    channelStr === 'stable' ||
    channelStr === 'beta' ||
    channelStr === 'nightly'
  ) {
    channel = channelStr;
  } else if (major && minor) {
    // Version channel
    channel = {
      major: parseInt(major),
      minor: parseInt(minor),
    };

    if (patch) {
      channel.patch = parseInt(patch);
    }

    if (beta === 'beta') {
      channel.prerelease = { name: 'beta' };
      if (betaNumber) {
        channel.prerelease.number = parseInt(betaNumber);
      }
    }
  } else {
    return null;
  }

  const result: ToolchainObject = { channel };

  if (year && month && day) {
    result.date = {
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
    };
  }

  if (host) {
    result.host = host;
  }

  return result;
}
