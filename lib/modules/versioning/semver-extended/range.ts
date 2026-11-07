import moo from 'moo';
import { regEx } from '../../../util/regex.ts';
import { satisfiesComparator } from '../generic-range.ts';
import type {
  Comparator,
  ComparatorSets,
  ParsedVersion,
  PartialVersion,
  RangeAlternative,
  RangeToken,
} from './types.ts';
import { compareRelease, compareVersions, suffixSource } from './version.ts';

const partialPattern = regEx(
  String.raw`^(?<prefix>[vV]?)(?<release>\d+(?:\.(?:\d+|[xX*])){0,9})${suffixSource}$`,
);
const wildcardPattern = regEx(/^[xX*]$/);

/* oxlint-disable renovate/require-regex-util -- moo lexer patterns must be native RegExp: moo recompiles their source with the native engine and rejects RE2 instances (TODO #12870) */
const rangeLexer = moo.compile({
  hyphen: { match: /\s+-\s+/, lineBreaks: true },
  whitespace: { match: /\s+/, lineBreaks: true },
  operator: { match: /(?:<=|>=|<|>)\s*/, lineBreaks: true },
  version: /[vV]?\d[0-9a-zA-Z.*+-]*/,
});
/* oxlint-enable renovate/require-regex-util */

/**
 * Parses a full, partial or wildcard version like `1.2.3.4`, `1.2` or `1.x`.
 * The first part must be numeric, so wildcard-only values like `*` or `x.x` are rejected.
 */
function parsePartial(input: string): PartialVersion | null {
  const matches = partialPattern.exec(input);
  if (!matches) {
    return null;
  }
  const groups: Partial<Record<string, string>> = matches.groups!;
  const { prefix, release } = matches.groups!;
  const { prerelease, build } = groups;
  const identifiers = release.split('.');
  const wildcardIndex = identifiers.findIndex((identifier) =>
    wildcardPattern.test(identifier),
  );
  const partial = identifiers.length < 3 || wildcardIndex !== -1;
  if (partial && (prerelease ?? build) !== undefined) {
    return null;
  }
  if (wildcardIndex === -1) {
    return {
      prefix,
      identifiers,
      parts: identifiers.map((identifier) => BigInt(identifier)),
      prerelease,
      exact: identifiers.length >= 3,
    };
  }
  return {
    prefix,
    identifiers,
    parts: identifiers
      .slice(0, wildcardIndex)
      .map((identifier) => BigInt(identifier)),
    exact: false,
  };
}

/**
 * Returns the given parts and prerelease as a version.
 */
function toVersion(partial: PartialVersion): ParsedVersion {
  return { releaseBig: partial.parts, prerelease: partial.prerelease };
}

/**
 * Returns the parts with the last part incremented.
 */
function bump(parts: bigint[]): bigint[] {
  return [...parts.slice(0, -1), parts.at(-1)! + 1n];
}

/**
 * Returns the lowest prerelease of the release parts, like npm's `1.3.0-0`, so that
 * a `<` comparator against it also excludes the prereleases of that release.
 */
function lowestPrerelease(releaseBig: bigint[]): ParsedVersion {
  return { releaseBig, prerelease: '0' };
}

/**
 * Returns the comparator for a `<`, `<=`, `>` or `>=` operator.
 */
function primitive(operator: string, partial: PartialVersion): Comparator {
  if (partial.exact) {
    return { operator, version: toVersion(partial) };
  }
  if (operator === '>') {
    return { operator: '>=', version: { releaseBig: bump(partial.parts) } };
  }
  if (operator === '<=') {
    return { operator: '<', version: lowestPrerelease(bump(partial.parts)) };
  }
  if (operator === '<') {
    return { operator, version: lowestPrerelease(partial.parts) };
  }
  return { operator, version: toVersion(partial) };
}

/**
 * Returns the comparators for a bare version, partial version or x-range.
 */
function xRange(partial: PartialVersion): Comparator[] {
  if (partial.exact) {
    return [{ operator: '=', version: toVersion(partial) }];
  }
  return [primitive('>=', partial), primitive('<=', partial)];
}

/**
 * Parses one term of a range, like `>=1.2.3.4` or `1.2.x`, or returns `null` for an invalid version.
 */
export function parseToken(
  operator: string,
  space: string,
  version: string,
): RangeToken | null {
  const partial = parsePartial(version);
  if (!partial) {
    return null;
  }
  return {
    operator,
    space,
    version,
    partial,
    comparators: operator ? [primitive(operator, partial)] : xRange(partial),
  };
}

/**
 * Splits an alternative into whitespace-separated runs of lexer tokens, or returns
 * `null` for input the lexer doesn't match.
 */
function lexTerms(text: string): moo.Token[][] | null {
  const terms: moo.Token[][] = [[]];
  try {
    for (const token of rangeLexer.reset(text)) {
      if (token.type === 'whitespace') {
        terms.push([]);
      } else {
        terms.at(-1)!.push(token);
      }
    }
  } catch {
    return null;
  }
  return terms.filter((term) => term.length);
}

/**
 * Parses one whitespace-separated term, a version with an optional operator, or returns `null`.
 */
function parseTerm(term: moo.Token[]): RangeToken | null {
  switch (term.map(({ type }) => type).join(' ')) {
    case 'version':
      return parseToken('', '', term[0].text);
    case 'operator version': {
      const operator = term[0].text.trimEnd();
      const space = term[0].text.slice(operator.length);
      return parseToken(operator, space, term[1].text);
    }
    default:
      return null;
  }
}

/**
 * Parses one `||` alternative, either a hyphen range or whitespace-separated terms.
 */
function parseAlternative(text: string): RangeAlternative | null {
  const terms = lexTerms(text);
  if (!terms) {
    return null;
  }

  const [first] = terms;
  if (
    terms.length === 1 &&
    first.map(({ type }) => type).join(' ') === 'version hyphen version'
  ) {
    const from = parseToken('>=', '', first[0].text);
    const to = parseToken('<=', '', first[2].text);
    if (!(from && to)) {
      return null;
    }
    return { text, hyphen: true, tokens: [from, to] };
  }

  const tokens: RangeToken[] = [];
  for (const term of terms) {
    const token = parseTerm(term);
    if (!token) {
      return null;
    }
    tokens.push(token);
  }
  return tokens.length ? { text, hyphen: false, tokens } : null;
}

/**
 * Parses an npm-like range into its `||` alternatives, or returns `null` for an invalid range.
 */
export function parseRangeAlternatives(
  range: string,
): RangeAlternative[] | null {
  const alternatives: RangeAlternative[] = [];
  for (const text of range.split('||')) {
    const alternative = parseAlternative(text);
    if (!alternative) {
      return null;
    }
    alternatives.push(alternative);
  }
  return alternatives;
}

/**
 * Returns the comparators of all tokens of an alternative.
 */
export function getComparators(alternative: RangeAlternative): Comparator[] {
  return alternative.tokens.flatMap((token) => token.comparators);
}

/**
 * Parses an npm-like range into comparator sets, or returns `null` for an invalid range.
 */
export function parseRange(range: string): ComparatorSets | null {
  return parseRangeAlternatives(range)?.map(getComparators) ?? null;
}

/**
 * Returns whether the version satisfies all comparators by version order alone.
 */
export function satisfiesOrder(
  version: ParsedVersion,
  comparators: Comparator[],
): boolean {
  return comparators.every((comparator) =>
    satisfiesComparator(
      compareVersions(version, comparator.version),
      comparator.operator,
    ),
  );
}

/**
 * Returns whether the version satisfies all comparators, where a prerelease
 * version also needs a comparator with a prerelease of the same release.
 */
export function satisfiesComparators(
  version: ParsedVersion,
  set: Comparator[],
): boolean {
  const satisfiesAll = satisfiesOrder(version, set);
  if (!satisfiesAll || version.prerelease === undefined) {
    return satisfiesAll;
  }
  return set.some(
    (comparator) =>
      comparator.version.prerelease !== undefined &&
      compareRelease(comparator.version.releaseBig, version.releaseBig) === 0,
  );
}

/**
 * Returns whether the version satisfies any of the comparator sets.
 */
export function satisfiesRange(
  version: ParsedVersion,
  sets: ComparatorSets,
): boolean {
  return sets.some((set) => satisfiesComparators(version, set));
}

/**
 * Returns whether the version is lower than a lower bound of the set.
 */
function isBelowSet(version: ParsedVersion, set: Comparator[]): boolean {
  return set.some((comparator) => {
    if (comparator.operator.startsWith('<')) {
      return false;
    }
    const comparison = compareVersions(version, comparator.version);
    if (comparison === 0) {
      return comparator.operator === '>';
    }
    return comparison < 0;
  });
}

/**
 * Returns whether the version is lower than every version the comparator sets allow.
 */
export function isBelowRange(
  version: ParsedVersion,
  sets: ComparatorSets,
): boolean {
  return sets.every((set) => isBelowSet(version, set));
}
