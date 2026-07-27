import { isNotNullOrUndefined } from '../../../util/array.ts';
import { regEx } from '../../../util/regex.ts';
import { parseVersion } from '../nuget/parser.ts';
import type { NugetVersion } from '../nuget/types.ts';
import { versionToString } from '../nuget/version.ts';
import { compare, sameReleaseParts } from './version.ts';

export type PaketOperator = '' | '=' | '==' | '>' | '>=' | '<' | '<=' | '~>';

export interface PaketConstraint {
  operator: PaketOperator;
  version: NugetVersion;
}

export interface PaketRange {
  strategy: '!' | '@' | null;
  constraints: PaketConstraint[];
  prereleaseTags: string[];
}

const constraintOperators: readonly string[] = [
  '=',
  '==',
  '>',
  '>=',
  '<',
  '<=',
  '~>',
];

const prereleaseTagRegex = regEx(/^[a-zA-Z][a-zA-Z0-9-]*$/);

/**
 * Paket only accepts these operator combinations for two-part constraints.
 */
function isValidPair(first: PaketOperator, second: PaketOperator): boolean {
  if (first === '~>') {
    return (
      second === '>' || second === '>=' || second === '<' || second === '<='
    );
  }

  if (first === '>' || first === '>=') {
    return second === '<' || second === '<=';
  }

  return false;
}

export function parseRange(input: string): PaketRange | null {
  if (!input?.trim()) {
    return null;
  }

  let text = input.trim();
  let strategy: PaketRange['strategy'] = null;
  if (text.startsWith('!') || text.startsWith('@')) {
    strategy = text[0] as '!' | '@';
    text = text.slice(1).trim();
  }

  const tokens = text.split(regEx(/\s+/));
  const constraints: PaketConstraint[] = [];
  let idx = 0;

  while (
    idx < tokens.length &&
    constraints.length < 2 &&
    constraintOperators.includes(tokens[idx])
  ) {
    const operator = tokens[idx] as PaketOperator;
    const versionToken = tokens[idx + 1];
    const version = versionToken ? parseVersion(versionToken) : null;
    if (!version) {
      return null;
    }
    constraints.push({ operator, version });
    idx += 2;
  }

  if (constraints.length === 0) {
    const version = parseVersion(tokens[0]);
    if (!version) {
      return null;
    }
    constraints.push({ operator: '', version });
    idx = 1;
  }

  if (
    constraints.length === 2 &&
    !isValidPair(constraints[0].operator, constraints[1].operator)
  ) {
    return null;
  }

  const prereleaseTags: string[] = [];
  for (const token of tokens.slice(idx)) {
    if (!prereleaseTagRegex.test(token)) {
      return null;
    }
    if (!prereleaseTags.includes(token)) {
      prereleaseTags.push(token);
    }
  }

  return { strategy, constraints, prereleaseTags };
}

export function rangeToString(range: PaketRange): string {
  const parts: string[] = [];
  for (const { operator, version } of range.constraints) {
    const versionStr = versionToString(version);
    parts.push(operator === '' ? versionStr : `${operator} ${versionStr}`);
  }
  parts.push(...range.prereleaseTags);
  return `${range.strategy ?? ''}${parts.join(' ')}`;
}

export function releaseParts(version: NugetVersion): number[] {
  const { major, minor, patch, revision } = version;
  return [major, minor, patch, revision].filter(isNotNullOrUndefined);
}

function versionFromParts(parts: number[]): NugetVersion {
  const [major, minor, patch, revision] = parts;
  const result: NugetVersion = { type: 'nuget-version', major };
  if (minor !== undefined) {
    result.minor = minor;
  }
  if (patch !== undefined) {
    result.patch = patch;
  }
  if (revision !== undefined) {
    result.revision = revision;
  }
  return result;
}

export function adaptToPrecision(
  version: NugetVersion,
  precision: number,
): NugetVersion {
  const parts = releaseParts(version).slice(0, precision);
  while (parts.length < precision) {
    parts.push(0);
  }
  return versionFromParts(parts);
}

export function bumpAtPrecision(
  version: NugetVersion,
  precision: number,
): NugetVersion {
  const parts = releaseParts(adaptToPrecision(version, precision));
  parts[precision - 1] += 1;
  return versionFromParts(parts);
}

/**
 * Upper bound of the pessimistic operator: chop off the last release part and
 * increment the remaining last number, so `~> 1.2.3` allows `< 1.3` and
 * `~> 1.2` allows `< 2`.
 */
export function twiddle(version: NugetVersion): NugetVersion {
  const precision = Math.max(releaseParts(version).length - 1, 1);
  return bumpAtPrecision(version, precision);
}

export type PaketInterval =
  | {
      kind:
        | 'specific'
        | 'override'
        | 'minimum'
        | 'greater-than'
        | 'maximum'
        | 'less-than';
      version: NugetVersion;
    }
  | {
      kind: 'range';
      from: NugetVersion;
      fromInclusive: boolean;
      to: NugetVersion;
      toInclusive: boolean;
    };

function intervalOfPair(
  first: PaketConstraint,
  second: PaketConstraint,
): PaketInterval {
  if (first.operator === '~>') {
    const cap = twiddle(first.version);

    if (second.operator === '>' || second.operator === '>=') {
      return {
        kind: 'range',
        from: second.version,
        fromInclusive: second.operator === '>=',
        to: cap,
        toInclusive: false,
      };
    }

    const to = compare(second.version, cap) < 0 ? second.version : cap;
    return {
      kind: 'range',
      from: first.version,
      fromInclusive: true,
      to,
      toInclusive: second.operator === '<=',
    };
  }

  return {
    kind: 'range',
    from: first.version,
    fromInclusive: first.operator === '>=',
    to: second.version,
    toInclusive: second.operator === '<=',
  };
}

const singleOperatorKind = {
  '': 'specific',
  '=': 'specific',
  '==': 'override',
  '>=': 'minimum',
  '>': 'greater-than',
  '<=': 'maximum',
  '<': 'less-than',
} as const;

export function intervalOf(constraints: PaketConstraint[]): PaketInterval {
  if (constraints.length === 2) {
    return intervalOfPair(constraints[0], constraints[1]);
  }

  const [{ operator, version }] = constraints;
  if (operator === '~>') {
    return {
      kind: 'range',
      from: version,
      fromInclusive: true,
      to: twiddle(version),
      toInclusive: false,
    };
  }
  return { kind: singleOperatorKind[operator], version };
}

const numericSegmentRegex = regEx(/^\d+$/);
const channelPrefixRegex = regEx(/^[a-zA-Z]+(?:-[a-zA-Z]+)*/);

function channelFromSegments(segments: string[]): string {
  const [first, second] = segments;
  if (first && !numericSegmentRegex.test(first)) {
    return first;
  }
  if (second && !numericSegmentRegex.test(second)) {
    return second;
  }
  return '';
}

/**
 * The channel name of a prerelease suffix, e.g. `alpha` for `alpha001` or
 * `beta` for `beta.2`.
 */
export function prereleaseChannel(prerelease: string): string {
  const segments = prerelease.split('.');
  if (segments.length > 1) {
    return channelFromSegments(segments);
  }

  const prefix = channelPrefixRegex.exec(prerelease);
  if (prefix) {
    return prefix[0];
  }

  return channelFromSegments(
    prerelease.split('-').filter((segment) => segment !== ''),
  );
}

type PrereleaseStatus = 'none' | 'all' | string[];

function prereleaseStatusOf(
  range: PaketRange,
  interval: PaketInterval,
): PrereleaseStatus {
  const { prereleaseTags } = range;
  if (
    prereleaseTags.length === 1 &&
    prereleaseTags[0].toLowerCase() === 'prerelease'
  ) {
    return 'all';
  }
  if (prereleaseTags.length > 0) {
    return prereleaseTags;
  }

  // Without explicit tags, prerelease versions used in the constraint itself
  // allow their own channels, e.g. `~> 1.2.3-alpha001` allows `alpha` versions.
  const bounds =
    interval.kind === 'range'
      ? [interval.from, interval.to]
      : [interval.version];
  const channels: string[] = [];
  for (const bound of bounds) {
    if (!bound.prerelease) {
      continue;
    }
    const channel = prereleaseChannel(bound.prerelease);
    if (!channels.includes(channel)) {
      channels.push(channel);
    }
  }
  return channels.length > 0 ? channels : 'none';
}

function isPrereleaseAllowed(
  version: NugetVersion,
  status: PrereleaseStatus,
): boolean {
  if (status === 'all') {
    return true;
  }
  if (status === 'none') {
    return !version.prerelease;
  }
  if (!version.prerelease) {
    return true;
  }
  return status.includes(prereleaseChannel(version.prerelease));
}

/**
 * Paket rule: a prerelease of a stable bound version counts as being in range
 * when its channel is allowed, e.g. `1.2.3-alpha1` satisfies `= 1.2.3 alpha`.
 */
function isPrereleaseOfBound(
  version: NugetVersion,
  bound: NugetVersion,
  status: PrereleaseStatus,
): boolean {
  return (
    status !== 'none' &&
    !bound.prerelease &&
    sameReleaseParts(version, bound) &&
    isPrereleaseAllowed(version, status)
  );
}

export function matches(version: NugetVersion, range: PaketRange): boolean {
  const interval = intervalOf(range.constraints);
  const status = prereleaseStatusOf(range, interval);

  switch (interval.kind) {
    case 'specific':
      return (
        compare(version, interval.version) === 0 ||
        isPrereleaseOfBound(version, interval.version, status)
      );
    case 'override':
      return compare(version, interval.version) === 0;
    case 'minimum': {
      const cmp = compare(version, interval.version);
      return (
        cmp === 0 ||
        (cmp > 0 && isPrereleaseAllowed(version, status)) ||
        isPrereleaseOfBound(version, interval.version, status)
      );
    }
    case 'greater-than':
      return (
        compare(version, interval.version) > 0 &&
        isPrereleaseAllowed(version, status)
      );
    case 'maximum': {
      const cmp = compare(version, interval.version);
      return cmp === 0 || (cmp < 0 && isPrereleaseAllowed(version, status));
    }
    case 'less-than':
      return (
        compare(version, interval.version) < 0 &&
        isPrereleaseAllowed(version, status) &&
        !isPrereleaseOfBound(version, interval.version, status)
      );
    case 'range': {
      const { from, fromInclusive, to, toInclusive } = interval;
      const lowerCmp = compare(version, from);
      const upperCmp = compare(version, to);
      const inLower = fromInclusive ? lowerCmp >= 0 : lowerCmp > 0;
      const inUpper = toInclusive
        ? upperCmp <= 0
        : upperCmp < 0 && !isPrereleaseOfBound(version, to, status);
      return (
        (inLower && inUpper && isPrereleaseAllowed(version, status)) ||
        isPrereleaseOfBound(version, from, status)
      );
    }
  }
}

export function isLessThanLowerBound(
  version: NugetVersion,
  range: PaketRange,
): boolean {
  const interval = intervalOf(range.constraints);
  switch (interval.kind) {
    case 'specific':
    case 'override':
    case 'minimum':
      return compare(version, interval.version) < 0;
    case 'greater-than':
      return compare(version, interval.version) <= 0;
    case 'maximum':
    case 'less-than':
      return false;
    case 'range':
      return interval.fromInclusive
        ? compare(version, interval.from) < 0
        : compare(version, interval.from) <= 0;
  }
}

/**
 * A rewritten range admits the new version numerically, but its prerelease
 * channel may still be blocked, so allow the channel with an explicit tag.
 */
export function ensurePrereleaseMatches(
  range: PaketRange,
  version: NugetVersion,
): PaketRange {
  if (!version.prerelease || matches(version, range)) {
    return range;
  }

  const channel = prereleaseChannel(version.prerelease);
  if (prereleaseTagRegex.test(channel)) {
    return { ...range, prereleaseTags: [...range.prereleaseTags, channel] };
  }
  return { ...range, prereleaseTags: ['prerelease'] };
}
