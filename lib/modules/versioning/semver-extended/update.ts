import type { RangeStrategy } from '../../../types/versioning.ts';
import {
  getComparators,
  isBelowRange,
  parseToken,
  satisfiesComparators,
  satisfiesOrder,
} from './range.ts';
import type {
  NewVersion,
  PartialVersion,
  RangeAlternative,
  RangeToken,
} from './types.ts';

/**
 * Renders the tokens of an alternative as a range string.
 */
function renderTokens({ hyphen, tokens }: RangeAlternative): string {
  if (hyphen) {
    return `${tokens[0].version} - ${tokens[1].version}`;
  }
  return tokens
    .map(({ operator, space, version }) => `${operator}${space}${version}`)
    .join(' ');
}

/**
 * Renders an updated alternative with the whitespace around the original alternative.
 */
function renderInPlace(
  original: RangeAlternative,
  updated: RangeAlternative,
): string {
  const trimmed = original.text.trim();
  const start = original.text.indexOf(trimmed);
  const leading = original.text.slice(0, start);
  const trailing = original.text.slice(start + trimmed.length);
  return `${leading}${renderTokens(updated)}${trailing}`;
}

/**
 * Returns the token with its operator and spacing and a new version.
 */
function withVersion(token: RangeToken, version: string): RangeToken {
  return parseToken(token.operator, token.space, version)!;
}

/**
 * Formats the release parts with the precision of the current token version:
 * a full version becomes `text`, a partial version keeps its number of parts and its wildcards.
 */
function withPrecision(
  partial: PartialVersion,
  parts: bigint[],
  text: string,
): string {
  if (partial.exact) {
    return `${partial.prefix}${text}`;
  }
  const formatted = partial.identifiers.map((identifier, index) =>
    index < partial.parts.length ? (parts[index] ?? 0n).toString() : identifier,
  );
  return `${partial.prefix}${formatted.join('.')}`;
}

/**
 * Returns an exclusive upper bound above the new version, zero-filled and cut to the
 * current bound's number of parts. A partial bound raises its last part, a full bound
 * raises the part of its last non-zero part and zeroes the parts after it.
 */
function upperBound(partial: PartialVersion, newVersion: NewVersion): string {
  const numericLength = partial.parts.length;
  const index = partial.exact
    ? Math.max(
        partial.parts.findLastIndex((part) => part !== 0n),
        0,
      )
    : numericLength - 1;

  const parts: bigint[] = [];
  for (let i = 0; i < numericLength; i += 1) {
    parts.push(i <= index ? (newVersion.parsed.releaseBig[i] ?? 0n) : 0n);
  }
  parts[index] += 1n;
  return withPrecision(partial, parts, parts.join('.'));
}

/**
 * Replaces a token that the new version doesn't satisfy by version order alone, keeping
 * its operator and, unless the new version is a prerelease, its precision.
 */
function replaceToken(
  token: RangeToken,
  newVersion: NewVersion,
): RangeToken | null {
  if (satisfiesOrder(newVersion.parsed, token.comparators)) {
    return token;
  }
  if (token.operator === '>') {
    return null;
  }
  if (token.operator === '<') {
    return withVersion(token, upperBound(token.partial, newVersion));
  }
  if (newVersion.parsed.prerelease !== undefined) {
    return withVersion(token, `${token.partial.prefix}${newVersion.text}`);
  }
  return withVersion(
    token,
    withPrecision(token.partial, newVersion.parsed.releaseBig, newVersion.text),
  );
}

/**
 * Moves a `>=` lower bound to the new version and replaces any other token that the
 * new version doesn't satisfy, or returns `null` for a `>` comparator.
 */
function bumpToken(
  token: RangeToken,
  newVersion: NewVersion,
): RangeToken | null {
  if (token.operator === '>') {
    return null;
  }
  if (token.operator === '>=') {
    return withVersion(token, `${token.partial.prefix}${newVersion.text}`);
  }
  return replaceToken(token, newVersion);
}

/**
 * Applies `update` to every token of the alternative, or returns `null` if a token can't be updated.
 */
function updateAlternative(
  alternative: RangeAlternative,
  update: (token: RangeToken) => RangeToken | null,
): RangeAlternative | null {
  const tokens: RangeToken[] = [];
  for (const token of alternative.tokens) {
    const updated = update(token);
    if (!updated) {
      return null;
    }
    tokens.push(updated);
  }
  return { ...alternative, tokens };
}

/**
 * Bumps every token of the alternative.
 */
function bumpAlternative(
  alternative: RangeAlternative,
  newVersion: NewVersion,
): RangeAlternative | null {
  return updateAlternative(alternative, (token) =>
    bumpToken(token, newVersion),
  );
}

/**
 * Replaces the tokens of the alternative that the new version doesn't satisfy.
 */
function replaceAlternative(
  alternative: RangeAlternative,
  newVersion: NewVersion,
): RangeAlternative | null {
  return updateAlternative(alternative, (token) =>
    replaceToken(token, newVersion),
  );
}

/**
 * Replaces the tokens of the alternative, and bumps it instead when the replaced
 * alternative still doesn't match a prerelease new version and bumping is possible.
 */
function replaceOrBumpAlternative(
  alternative: RangeAlternative,
  newVersion: NewVersion,
): RangeAlternative | null {
  const replaced = replaceAlternative(alternative, newVersion);
  if (
    !replaced ||
    newVersion.parsed.prerelease === undefined ||
    satisfiesComparators(newVersion.parsed, getComparators(replaced))
  ) {
    return replaced;
  }
  return bumpAlternative(alternative, newVersion) ?? replaced;
}

/**
 * Widens a range that doesn't match the new version: a prerelease or a new version below
 * the range is appended as an exact version with `||`, an upper bound at the end is replaced
 * in place, and otherwise the replaced last alternative is appended with `||`.
 * Returns `null` for a multi-comparator alternative ending in a lower bound.
 */
function widenRange(
  alternatives: RangeAlternative[],
  newVersion: NewVersion,
): string | null {
  const range = alternatives.map(({ text }) => text).join('||');
  const last = alternatives.at(-1)!;
  const lastToken = last.tokens.at(-1)!;
  if (
    newVersion.parsed.prerelease !== undefined ||
    isBelowRange(newVersion.parsed, alternatives.map(getComparators))
  ) {
    return `${range} || ${lastToken.partial.prefix}${newVersion.text}`;
  }
  const lastOperator = lastToken.operator;
  if (last.tokens.length > 1 && lastOperator.startsWith('>')) {
    return null;
  }
  const replaced = replaceAlternative(last, newVersion);
  if (!replaced) {
    return null;
  }
  if (lastOperator.startsWith('<')) {
    const kept = alternatives.slice(0, -1).map(({ text }) => text);
    return [...kept, renderInPlace(last, replaced)].join('||');
  }
  return `${range} || ${renderTokens(replaced)}`;
}

/**
 * Updates the alternatives of a valid range to include the new version, bumping them for
 * `rangeStrategy` `bump`, widening them for `widen` and replacing them for any other strategy.
 * Alternatives that aren't updated keep their original text.
 */
export function updateRange(
  alternatives: RangeAlternative[],
  rangeStrategy: RangeStrategy,
  newVersion: NewVersion,
): string | null {
  const isBump = rangeStrategy === 'bump';
  const matching = alternatives.filter((alternative) =>
    satisfiesComparators(newVersion.parsed, getComparators(alternative)),
  );
  if (!matching.length && rangeStrategy === 'widen') {
    return widenRange(alternatives, newVersion);
  }
  if (!matching.length) {
    const last = alternatives.at(-1)!;
    const updated = isBump
      ? bumpAlternative(last, newVersion)
      : replaceOrBumpAlternative(last, newVersion);
    return updated ? renderTokens(updated) : null;
  }
  const range = alternatives.map(({ text }) => text).join('||');
  if (!isBump) {
    return range;
  }

  const updated = alternatives.map((alternative) => {
    if (!matching.includes(alternative)) {
      return alternative.text;
    }
    const bumped = bumpAlternative(alternative, newVersion);
    return bumped ? renderInPlace(alternative, bumped) : null;
  });
  return updated.includes(null) ? null : updated.join('||');
}
