import { logger } from '../../../../logger/index.ts';
import { regEx } from '../../../../util/regex.ts';
import type {
  ChecksumData,
  ChecksumEntry,
  MultiSourceData,
  SourceEntry,
} from '../types.ts';

/**
 * Extract all checksums of a given type from PKGBUILD content.
 * Supports architecture-specific checksums (e.g., sha256sums_x86_64).
 */
export function extractAllChecksumsOfType(
  content: string,
  type: 'sha256' | 'sha512' | 'b2' | 'md5',
  length: number,
): ChecksumEntry[] {
  // RE2 doesn't support backreferences, so try each quote style separately.
  // PKGBUILD checksum arrays are always quoted per Arch packaging guidelines,
  // so we only handle single- and double-quoted forms.
  const entries: ChecksumEntry[] = [];

  // Try single-quoted checksums: sha256sums=('abc...') or sha256sums_x86_64=('abc...')
  const singleQuoteRegex = regEx(
    `${type}sums(?:_(?<suffix>[^=]+))?=\\('(?<value>[a-fA-F0-9]{${length}})'\\)`,
    'g',
  );
  for (const match of content.matchAll(singleQuoteRegex)) {
    const { suffix, value } = match.groups!;
    entries.push({
      value,
      suffix: suffix ? `_${suffix}` : undefined,
    });
  }

  // Try double-quoted checksums: sha256sums=("abc...")
  const doubleQuoteRegex = regEx(
    `${type}sums(?:_(?<suffix>[^=]+))?=\\("(?<value>[a-fA-F0-9]{${length}})"\\)`,
    'g',
  );
  for (const match of content.matchAll(doubleQuoteRegex)) {
    const { suffix, value } = match.groups!;
    entries.push({
      value,
      suffix: suffix ? `_${suffix}` : undefined,
    });
  }

  return entries;
}

/**
 * Normalize checksum entries into a single value or an array.
 * Returns the plain string for a single non-arch-specific checksum,
 * the full array for multiple/arch-specific entries, or undefined if empty.
 */
export function normalizeChecksumEntries(
  entries: ChecksumEntry[],
): string | ChecksumEntry[] | undefined {
  if (entries.length === 1 && !entries[0].suffix) {
    return entries[0].value;
  }
  if (entries.length > 0) {
    return entries;
  }
  return undefined;
}

export const checksumTypes: {
  type: 'sha256' | 'sha512' | 'b2' | 'md5';
  length: number;
}[] = [
  { type: 'sha256', length: 64 },
  { type: 'sha512', length: 128 },
  { type: 'b2', length: 128 },
  { type: 'md5', length: 32 },
];

/**
 * Extract checksums from PKGBUILD content
 * Supports architecture-specific checksums (e.g., sha256sums_x86_64)
 */
export function extractChecksums(content: string): ChecksumData {
  const checksums: ChecksumData = {};

  for (const { type, length } of checksumTypes) {
    const entries = extractAllChecksumsOfType(content, type, length);
    const normalized = normalizeChecksumEntries(entries);
    if (normalized !== undefined) {
      checksums[type] = normalized;
    }
  }

  return checksums;
}

/**
 * Extract pkgver from PKGBUILD
 * Handles comments, quotes, and bash variables
 */
export function extractPkgver(content: string): string | null {
  const pkgverRegex = regEx(/^pkgver=(.+)$/m);
  const match = pkgverRegex.exec(content);
  if (!match) {
    return null;
  }

  let pkgver = match[1].trim();

  // Remove inline comments (everything after #, but keep the version part before it)
  const commentIndex = pkgver.indexOf('#');
  if (commentIndex !== -1) {
    pkgver = pkgver.substring(0, commentIndex).trim();
  }

  // Remove surrounding quotes
  pkgver = pkgver.replace(regEx(/^["']|["']$/g), '');

  // Skip versions with unresolved bash variables
  if (pkgver.includes('${') || pkgver.includes('$_') || pkgver.includes('$(')) {
    logger.debug(`Skipping version with bash variables: ${pkgver}`);
    return null;
  }

  return pkgver;
}

/**
 * Extract pkgname from PKGBUILD
 * Handles comments, quotes, and bash variables
 */
export function extractPkgname(content: string): string | null {
  const pkgnameRegex = regEx(/^pkgname=(.+)$/m);
  const match = pkgnameRegex.exec(content);
  if (!match) {
    return null;
  }

  let pkgname = match[1].trim();

  // Remove inline comments (everything after #)
  const commentIndex = pkgname.indexOf('#');
  if (commentIndex !== -1) {
    pkgname = pkgname.substring(0, commentIndex).trim();
  }

  // Remove surrounding quotes
  pkgname = pkgname.replace(regEx(/^["']|["']$/g), '');

  // Skip packages with unresolved bash variables
  // These need variable expansion which is complex in PKGBUILD context
  if (
    pkgname.includes('${') ||
    pkgname.includes('$_') ||
    pkgname.includes('$(')
  ) {
    logger.debug(`Skipping package with bash variables: ${pkgname}`);
    return null;
  }

  // Skip array-style package names for now
  if (pkgname.startsWith('(')) {
    logger.debug(`Skipping array-style package name: ${pkgname}`);
    return null;
  }

  return pkgname;
}

/**
 * Extract variable definitions from PKGBUILD
 * Extracts standard variables (url, pkgname, pkgver) and all underscore-prefixed
 * custom variables (e.g., _pkgver, _basever, _commit) which are commonly used
 * in source URLs.
 */
export function extractVariables(content: string): Map<string, string> {
  const vars = new Map<string, string>();

  // Extract standard variables
  const standardPatterns = [
    regEx(/^url=["']?([^"'\n]+)["']?$/m),
    regEx(/^pkgname=["']?([^"'\n]+)["']?$/m),
    regEx(/^pkgver=["']?([^"'\n#]+)["']?/m),
  ];

  const standardNames = ['url', 'pkgname', 'pkgver'];

  standardPatterns.forEach((pattern, i) => {
    const match = pattern.exec(content);
    if (match) {
      vars.set(standardNames[i], match[1].trim());
    }
  });

  // Extract all underscore-prefixed variables (_pkgver, _basever, _name, etc.)
  const underscoreVarRegex = regEx(
    /^(_[a-zA-Z_][a-zA-Z0-9_]*)=["']?([^"'\n#]+)["']?/gm,
  );
  for (const match of content.matchAll(underscoreVarRegex)) {
    vars.set(match[1], match[2].trim());
  }

  return vars;
}

/**
 * Expand bash variables in a string using extracted variable values
 * Handles: ${var}, $var, and ${var%-suffix} patterns
 */
export function expandVariables(
  str: string,
  vars: Map<string, string>,
): string {
  let expanded = str;

  // Expand ${var%-suffix} and ${var#prefix} (parameter substitution)
  // Match: ${varname%-suffix} or ${varname#prefix}
  expanded = expanded.replace(
    regEx(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)(%|#)(.*?)\}/g),
    (match, varName, operator, operand) => {
      const value = vars.get(varName);
      if (!value) {
        return match;
      }

      if (!operand) {
        return value;
      }

      // Handle suffix removal: ${var%-suffix}
      if (operator === '%') {
        const suffix = operand;
        return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
      }
      // Handle prefix removal: ${var#prefix}
      return value.startsWith(operand) ? value.slice(operand.length) : value;
    },
  );

  // Expand simple ${var}
  expanded = expanded.replace(
    regEx(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g),
    (match, varName) => {
      return vars.get(varName) ?? match;
    },
  );

  // Expand simple $var
  expanded = expanded.replace(
    regEx(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g),
    (match, varName) => {
      return vars.get(varName) ?? match;
    },
  );

  return expanded;
}

/**
 * Extract all quoted or unquoted entries from a PKGBUILD array block.
 * RE2 doesn't support backreferences, so we match single-quoted, double-quoted,
 * and unquoted tokens separately, then merge them in order of appearance.
 */
export function extractBlockEntries(block: string): string[] {
  const found: { index: number; value: string }[] = [];

  // Match single-quoted entries
  const singleQuoteRegex = regEx(/'([^']+)'/g);
  for (const entryMatch of block.matchAll(singleQuoteRegex)) {
    found.push({ index: entryMatch.index, value: entryMatch[1] });
  }

  // Match double-quoted entries
  const doubleQuoteRegex = regEx(/"([^"]+)"/g);
  for (const entryMatch of block.matchAll(doubleQuoteRegex)) {
    found.push({ index: entryMatch.index, value: entryMatch[1] });
  }

  // Match unquoted entries (tokens not inside quotes)
  // First, build a set of ranges covered by quoted entries
  const coveredRanges: { start: number; end: number }[] = [];
  const allQuotesRegex = regEx(/'[^']*'|"[^"]*"/g);
  for (const entryMatch of block.matchAll(allQuotesRegex)) {
    coveredRanges.push({
      start: entryMatch.index,
      end: entryMatch.index + entryMatch[0].length,
    });
  }

  const unquotedRegex = regEx(/([^\s'"()]+)/g);
  for (const entryMatch of block.matchAll(unquotedRegex)) {
    const pos = entryMatch.index;
    // Only include if not inside a quoted range
    const insideQuote = coveredRanges.some(
      (r) => pos >= r.start && pos < r.end,
    );
    if (!insideQuote) {
      found.push({ index: pos, value: entryMatch[1] });
    }
  }

  // Sort by position to preserve original order
  found.sort((a, b) => a.index - b.index);

  return found.map((f) => f.value);
}

export function extractSource(content: string): string | null {
  // Match the entire source=(...) block, handling multi-line
  const sourceBlockRegex = regEx(/^source(?:_[^=]+)?=\(([\s\S]*?)\)/m);
  const blockMatch = sourceBlockRegex.exec(content);

  if (!blockMatch) {
    return null;
  }

  const sourceBlock = blockMatch[1];

  // Extract the first entry from the block (quoted or unquoted)
  const entries = extractBlockEntries(sourceBlock);

  if (entries.length === 0) {
    return null;
  }

  let sourceUrl = entries[0];

  // Handle filename::url format - extract just the URL part after ::
  const filenameSeparator = sourceUrl.indexOf('::');
  if (filenameSeparator !== -1) {
    sourceUrl = sourceUrl.substring(filenameSeparator + 2);
  }

  // Expand bash variables in the URL
  const vars = extractVariables(content);
  sourceUrl = expandVariables(sourceUrl, vars);

  // Skip URLs that still contain unexpanded variables
  if (
    sourceUrl.includes('${') ||
    sourceUrl.includes('$_') ||
    sourceUrl.includes('$(')
  ) {
    logger.debug(`Skipping source URL with unexpanded variables: ${sourceUrl}`);
    return null;
  }

  return sourceUrl;
}

/**
 * Extract all sources from PKGBUILD source array
 * Handles multi-line arrays and tracks which sources use version variables
 * (pkgver or any custom variable whose value matches pkgver)
 */
export function extractAllSources(
  content: string,
  versionVariables?: string[],
): SourceEntry[] {
  const sources: SourceEntry[] = [];

  // Match the entire source=(...) block, handling multi-line
  const sourceBlockRegex = regEx(/^source(?:_[^=]+)?=\(([\s\S]*?)\)/m);
  const blockMatch = sourceBlockRegex.exec(content);

  if (!blockMatch) {
    return sources;
  }

  const sourceBlock = blockMatch[1];

  // Extract individual entries from the block
  const entries = extractBlockEntries(sourceBlock);

  for (const url of entries) {
    let usesPkgver = url.includes('$' + '{pkgver}') || url.includes('$pkgver');

    // Check if the URL references any custom variable that holds the pkgver value
    if (!usesPkgver && versionVariables) {
      for (const varName of versionVariables) {
        if (url.includes('$' + `{${varName}}`) || url.includes(`$${varName}`)) {
          usesPkgver = true;
          break;
        }
      }
    }

    sources.push({ url, usesPkgver });
  }

  return sources;
}

/**
 * Extract all checksums of a given type as an array (including SKIP)
 */
export function extractChecksumArray(
  content: string,
  type: 'sha256' | 'sha512' | 'b2' | 'md5',
): string[] | null {
  // Match the entire checksums block
  const checksumBlockRegex = regEx(
    `^${type}sums(?:_[^=]+)?=\\(([\\s\\S]*?)\\)`,
    'm',
  );
  const match = checksumBlockRegex.exec(content);

  if (!match) {
    return null;
  }

  const checksumBlock = match[1];

  // Extract individual checksums (hex values or SKIP)
  const checksums = extractBlockEntries(checksumBlock);

  return checksums.length > 0 ? checksums : null;
}

/**
 * Extract multi-source data from PKGBUILD
 */
export function extractMultiSourceData(
  content: string,
  versionVariables?: string[],
): MultiSourceData {
  return {
    sources: extractAllSources(content, versionVariables),
    checksums: {
      sha256: extractChecksumArray(content, 'sha256') ?? undefined,
      sha512: extractChecksumArray(content, 'sha512') ?? undefined,
      b2: extractChecksumArray(content, 'b2') ?? undefined,
      md5: extractChecksumArray(content, 'md5') ?? undefined,
    },
  };
}
