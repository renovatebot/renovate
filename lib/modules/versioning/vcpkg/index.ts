import type { SemVer } from 'semver';
import { coerce } from 'semver';
import { regEx } from '../../../util/regex.ts';
import { api as loose } from '../loose/index.ts';
import { api as semver } from '../semver/index.ts';
import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'vcpkg';
export const displayName = 'vcpkg';
export const urls = ['https://learn.microsoft.com/vcpkg/users/versioning'];
export const supportsRanges = false;

type Scheme = 'date' | 'numeric' | 'string' | 'invalid';

interface ParsedVersion {
  base: string;
  portVersion: number;
  scheme: Scheme;
  strictSemver: boolean;
  dateHead?: string;
  dateTail?: number[];
}

const portVersionRegex = regEx(/^(?<base>.*)#(?<port>\d+)$/);
const dateRegex = regEx(
  /^(?<head>\d{4}-\d{2}-\d{2})(?<tail>(?:\.(?:0|[1-9]\d*))*)$/,
);
const numericRegex = regEx(
  /^\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
);
const numericPrereleaseRegex = regEx(/-[0-9A-Za-z.-]+(?:\+[0-9A-Za-z.-]+)?$/);
const numericBuildRegex = regEx(/\+[0-9A-Za-z.-]+$/);
const strictSemverRegex = regEx(
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
);

function splitPortVersion(input: string): {
  base: string;
  portVersion: number;
} {
  const match = portVersionRegex.exec(input);
  if (match?.groups) {
    return {
      base: match.groups.base,
      portVersion: Number.parseInt(match.groups.port, 10),
    };
  }
  return { base: input, portVersion: 0 };
}

function isValidDateHead(head: string): boolean {
  // Caller guarantees `head` matches the YYYY-MM-DD prefix, so the split
  // always yields three numeric parts.
  const [yearStr, monthStr, dayStr] = head.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  // Manually validate day-of-month against actual month length.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function matchDate(base: string): { head: string; tail: number[] } | null {
  const match = dateRegex.exec(base);
  if (!match?.groups) {
    return null;
  }
  const tail = match.groups.tail
    ? match.groups.tail
        .slice(1)
        .split('.')
        .map((s) => Number.parseInt(s, 10))
    : [];
  return { head: match.groups.head, tail };
}

function detectScheme(base: string): Scheme {
  const dateParts = matchDate(base);
  if (dateParts) {
    // A date-shaped base must parse as a real calendar date, otherwise the
    // whole version is rejected rather than falling back to another scheme.
    return isValidDateHead(dateParts.head) ? 'date' : 'invalid';
  }
  if (numericRegex.test(base)) {
    return 'numeric';
  }
  return 'string';
}

function parse(input: string | undefined | null): ParsedVersion | null {
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  const { base, portVersion } = splitPortVersion(trimmed);
  if (base === '') {
    return null;
  }
  const scheme = detectScheme(base);
  if (scheme === 'invalid') {
    return null;
  }
  const strictSemver =
    scheme === 'numeric' &&
    strictSemverRegex.test(base) &&
    semver.isValid(base);
  if (scheme === 'date') {
    const dateParts = matchDate(base);
    /* v8 ignore next 3 -- detectScheme guarantees matchDate succeeds */
    if (!dateParts) {
      return null;
    }
    return {
      base,
      portVersion,
      scheme,
      strictSemver,
      dateHead: dateParts.head,
      dateTail: dateParts.tail,
    };
  }
  return { base, portVersion, scheme, strictSemver };
}

function compareBase(a: ParsedVersion, b: ParsedVersion): number {
  if (a.scheme !== b.scheme) {
    // Cross-scheme bases are not orderable in vcpkg, callers fall back to
    // port-version which is also of limited meaning across schemes.
    return 0;
  }
  if (a.scheme === 'date') {
    // `parse` guarantees `dateHead` and `dateTail` are populated for the
    // `date` scheme, so the non-null assertions are safe.
    const aHead = a.dateHead!;
    const bHead = b.dateHead!;
    if (aHead !== bHead) {
      return aHead < bHead ? -1 : 1;
    }
    // Same date head, compare disambiguation tail per the relaxed `version`
    // scheme rule, so a version with the smaller set of sections takes
    // precedence (i.e. sorts earlier).
    const aTail = a.dateTail!;
    const bTail = b.dateTail!;
    const minLen = Math.min(aTail.length, bTail.length);
    for (let i = 0; i < minLen; i += 1) {
      if (aTail[i] !== bTail[i]) {
        return aTail[i] < bTail[i] ? -1 : 1;
      }
    }
    if (aTail.length !== bTail.length) {
      return aTail.length < bTail.length ? -1 : 1;
    }
    return 0;
  }
  if (a.scheme === 'numeric') {
    if (a.strictSemver && b.strictSemver) {
      return semver.sortVersions(a.base, b.base);
    }
    return loose.sortVersions(a.base, b.base);
  }
  // Opaque strings have no ordering.
  return 0;
}

function compare(a: ParsedVersion, b: ParsedVersion): number {
  const baseResult = compareBase(a, b);
  if (baseResult !== 0) {
    return baseResult;
  }
  return a.portVersion - b.portVersion;
}

function isValid(input: string): boolean {
  return parse(input) !== null;
}

function isVersion(input: string | undefined | null): boolean {
  const parsed = parse(input ?? '');
  if (!parsed) {
    return false;
  }
  return parsed.scheme !== 'string';
}

function isCompatible(version: string): boolean {
  return isValid(version);
}

function isSingleVersion(version: string): boolean {
  return isVersion(version);
}

function isStable(version: string): boolean {
  const parsed = parse(version);
  if (!parsed) {
    return false;
  }
  if (parsed.scheme === 'numeric') {
    // A pre-release suffix (`-...`) marks the version as unstable.
    // Pure build metadata (`+...`) is ignored, matching SemVer.
    const withoutBuild = parsed.base.replace(numericBuildRegex, '');
    return !numericPrereleaseRegex.test(withoutBuild);
  }
  // Date and opaque-string versions have no prerelease concept, treat as stable.
  return true;
}

function coerceNumeric(base: string, strictSemver: boolean): SemVer | null {
  if (strictSemver) {
    return coerce(base);
  }
  // Strip any pre-release or build suffix before coercion so loose forms like
  // `1.2-alpha` map to `1.2.0` instead of failing.
  const stripped = base
    .replace(numericBuildRegex, '')
    .replace(numericPrereleaseRegex, '');
  return coerce(stripped);
}

function getMajor(version: string | SemVer): number | null {
  const input = typeof version === 'string' ? version : version.version;
  const parsed = parse(input);
  if (parsed?.scheme !== 'numeric') {
    return null;
  }
  /* v8 ignore next -- coerce always succeeds for `numeric` bases */
  return coerceNumeric(parsed.base, parsed.strictSemver)?.major ?? null;
}

function getMinor(version: string | SemVer): number | null {
  const input = typeof version === 'string' ? version : version.version;
  const parsed = parse(input);
  if (parsed?.scheme !== 'numeric') {
    return null;
  }
  /* v8 ignore next -- coerce always succeeds for `numeric` bases */
  return coerceNumeric(parsed.base, parsed.strictSemver)?.minor ?? null;
}

function getPatch(version: string | SemVer): number | null {
  const input = typeof version === 'string' ? version : version.version;
  const parsed = parse(input);
  if (parsed?.scheme !== 'numeric') {
    return null;
  }
  /* v8 ignore next -- coerce always succeeds for `numeric` bases */
  return coerceNumeric(parsed.base, parsed.strictSemver)?.patch ?? null;
}

function equals(version: string, other: string): boolean {
  const a = parse(version);
  const b = parse(other);
  if (!a || !b) {
    return false;
  }
  if (a.scheme !== b.scheme) {
    return false;
  }
  if (a.portVersion !== b.portVersion) {
    return false;
  }
  if (a.scheme === 'numeric') {
    if (a.strictSemver && b.strictSemver) {
      return semver.equals(a.base, b.base);
    }
    return loose.equals(a.base, b.base);
  }
  // Both date and opaque-string compare by exact string equality on the base.
  return a.base === b.base;
}

function isGreaterThan(version: string, other: string): boolean {
  const a = parse(version);
  const b = parse(other);
  if (!a || !b) {
    return false;
  }
  if (a.scheme !== b.scheme) {
    return false;
  }
  // Opaque strings have no ordering beyond equality.
  if (a.scheme === 'string') {
    return false;
  }
  return compare(a, b) > 0;
}

function sortVersions(version: string, other: string): number {
  const a = parse(version);
  const b = parse(other);
  if (!a || !b) {
    return 0;
  }
  return compare(a, b);
}

function matches(version: string, range: string): boolean {
  // vcpkg manifest dependencies use a `>=` lower-bound operator. For numeric
  // and date schemes that is a real ordering; for opaque strings the base must
  // match exactly because string ordering is undefined, but the port-version
  // still provides a `>=` comparison once the base matches.
  const v = parse(version);
  const r = parse(range);
  if (!v || !r) {
    return false;
  }
  if (v.scheme !== r.scheme) {
    return false;
  }
  if (v.scheme === 'string') {
    return v.base === r.base && v.portVersion >= r.portVersion;
  }
  return compare(v, r) >= 0;
}

function getSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  let bestStr: string | null = null;
  let bestParsed: ParsedVersion | null = null;
  for (const version of versions) {
    if (!matches(version, range)) {
      continue;
    }
    const parsed = parse(version);
    /* v8 ignore next 3 -- parse succeeds for any matches-accepted input */
    if (!parsed) {
      continue;
    }
    if (!bestParsed || compare(parsed, bestParsed) > 0) {
      bestParsed = parsed;
      bestStr = version;
    }
  }
  return bestStr;
}

function minSatisfyingVersion(
  versions: string[],
  range: string,
): string | null {
  let bestStr: string | null = null;
  let bestParsed: ParsedVersion | null = null;
  for (const version of versions) {
    if (!matches(version, range)) {
      continue;
    }
    const parsed = parse(version);
    /* v8 ignore next 3 -- parse succeeds for any matches-accepted input */
    if (!parsed) {
      continue;
    }
    if (!bestParsed || compare(parsed, bestParsed) < 0) {
      bestParsed = parsed;
      bestStr = version;
    }
  }
  return bestStr;
}

function getNewValue({ newVersion }: NewValueConfig): string {
  return newVersion;
}

export const api: VersioningApi = {
  equals,
  getMajor,
  getMinor,
  getPatch,
  isCompatible,
  isGreaterThan,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,
  matches,
  getSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,
};

export default api;
