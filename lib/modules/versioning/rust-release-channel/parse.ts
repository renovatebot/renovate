import { regEx } from '../../../util/regex.ts';
import type { ToolchainObject, VersionObject } from './types.ts';

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
  const regex = regEx(
    /^(?<channel>stable|beta|nightly|(?<major>\d+)\.(?<minor>\d+)(?:\.(?<patch>\d+))?(?:-(?<beta>beta)(?:\.(?<betaNumber>\d+))?)?)(?:-(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2}))?(?:-(?<host>.+))?$/,
  );

  const match = regex.exec(input);
  if (!match?.groups) {
    return null;
  }
  const {
    channel: channelStr,
    major,
    minor,
    patch,
    beta,
    betaNumber,
    year,
    month,
    day,
    host,
  } = match.groups;

  let channel: 'stable' | 'beta' | 'nightly' | VersionObject;
  if (
    channelStr === 'stable' ||
    channelStr === 'beta' ||
    channelStr === 'nightly'
  ) {
    channel = channelStr;
  } else {
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
