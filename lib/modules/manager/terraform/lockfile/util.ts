import { isNullOrUndefined } from '@sindresorhus/is';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../../util/fs/index.ts';
import { newlineRegex, regEx } from '../../../../util/regex.ts';
import { get as getVersioning } from '../../../versioning/index.ts';
import type { UpdateArtifactsResult } from '../../types.ts';
import type {
  LineNumbers,
  ProviderLock,
  ProviderLockUpdate,
  ProviderSlice,
} from './types.ts';

const providerStartLineRegex = regEx(
  `^provider "(?<registryUrl>[^/]*)/(?<namespace>[^/]*)/(?<depName>[^/]*)"`,
);
const versionLineRegex = regEx(
  `^(?<prefix>[\\s]*version[\\s]*=[\\s]*")(?<version>[^"']+)(?<suffix>".*)$`,
);
const constraintLineRegex = regEx(
  `^(?<prefix>[\\s]*constraints[\\s]*=[\\s]*")(?<constraint>[^"']+)(?<suffix>".*)$`,
);
const hashLineRegex = regEx(`^(?<prefix>\\s*")(?<hash>[^"]+)(?<suffix>",.*)$`);

const lockFile = '.terraform.lock.hcl';

export function findLockFile(packageFilePath: string): Promise<string | null> {
  return findLocalSiblingOrParent(packageFilePath, lockFile);
}

export function readLockFile(lockFilePath: string): Promise<string | null> {
  return readLocalFile(lockFilePath, 'utf8');
}

export function extractLocks(lockFileContent: string): ProviderLock[] | null {
  const lines = lockFileContent.split(newlineRegex);
  const blockStarts: number[] = [];
  // get first lines of blocks
  lines.forEach((line, index) => {
    if (line.startsWith('provider "')) {
      blockStarts.push(index);
    }
  });

  // sort ascending
  const sortedStarts = blockStarts.sort((a, b) => a - b);
  const contentSlices = sortedStarts.map((start, index, array) => {
    let end: number;
    if (index < array.length - 1) {
      end = array[index + 1];
    } else {
      end = lines.length - 1;
    }
    const slice: ProviderSlice = {
      lines: lines.slice(start, end),
      block: {
        start,
        end,
      },
    };
    return slice;
  });

  // generate Lock objects from slices
  const locks = contentSlices.map((slice) => {
    let packageName = '';
    let registryUrl = '';
    let version = '';
    let constraints = '';
    const relativeLineNumbers: LineNumbers = {
      block: slice.block,
      hashes: {
        start: -1,
        end: -1,
      },
    };
    const hashes: string[] = [];

    slice.lines.forEach((line, index) => {
      const hashLineResult = hashLineRegex.exec(line);
      if (hashLineResult?.groups) {
        hashes.push(hashLineResult.groups.hash);
        relativeLineNumbers.hashes.start =
          relativeLineNumbers.hashes.start === -1
            ? index
            : relativeLineNumbers.hashes.start;
        relativeLineNumbers.hashes.end = index;
        return;
      }

      const providerStartLineResult = providerStartLineRegex.exec(line);
      if (providerStartLineResult?.groups) {
        packageName = `${providerStartLineResult.groups.namespace}/${providerStartLineResult.groups.depName}`;
        registryUrl = providerStartLineResult.groups.registryUrl;
        return;
      }

      const versionLineResult = versionLineRegex.exec(line);
      if (versionLineResult?.groups) {
        version = versionLineResult.groups.version;
        relativeLineNumbers.version = index;
        return;
      }

      const constraintLineResult = constraintLineRegex.exec(line);
      if (constraintLineResult?.groups) {
        constraints = constraintLineResult.groups.constraint;
        relativeLineNumbers.constraint = index;
      }
    });

    const lock: ProviderLock = {
      packageName,
      registryUrl: `https://${registryUrl}`,
      version,
      constraints,
      hashes,
      lineNumbers: relativeLineNumbers,
    };
    return lock;
  });

  if (locks.length === 0) {
    return null;
  }
  return locks;
}

export function isPinnedVersion(value: string | undefined): boolean {
  const versioning = getVersioning('hashicorp');
  return !!value && !!versioning.isSingleVersion(value);
}

export function writeLockUpdates(
  updates: ProviderLockUpdate[],
  lockFilePath: string,
  oldLockFileContent: string,
): UpdateArtifactsResult {
  const lines = oldLockFileContent.split(newlineRegex);

  const sections: string[][] = [];

  // sort updates in order of appearance in the lockfile
  // TODO #22198
  updates.sort(
    (a, b) => a.lineNumbers.block!.start - b.lineNumbers.block!.start,
  );
  updates.forEach((update, index, array) => {
    // re add leading whitespace
    let startWhitespace: number | undefined;
    if (index > 0) {
      // get end of the
      // TODO #22198
      startWhitespace = array[index - 1].lineNumbers.block!.end;
    }
    const leadingNonRelevantLines = lines.slice(
      startWhitespace,
      // TODO #22198
      update.lineNumbers.block!.start,
    );
    sections.push(leadingNonRelevantLines);

    const providerBlockLines = lines.slice(
      // TODO #22198
      update.lineNumbers.block!.start,
      update.lineNumbers.block!.end,
    );
    const newProviderBlockLines: string[] = [];
    let hashLinePrefix = '';
    let hashLineSuffix = '';
    providerBlockLines.forEach((providerBlockLine) => {
      const versionLine = providerBlockLine.replace(
        versionLineRegex,
        `$<prefix>${update.newVersion}$<suffix>`,
      );
      if (versionLine !== providerBlockLine) {
        newProviderBlockLines.push(versionLine);
        return;
      }

      const constraintLine = providerBlockLine.replace(
        constraintLineRegex,
        `$<prefix>${update.newConstraint}$<suffix>`,
      );
      if (constraintLine !== providerBlockLine) {
        newProviderBlockLines.push(constraintLine);
        return;
      }

      const hashLineRegexResult = hashLineRegex.exec(providerBlockLine);
      if (hashLineRegexResult?.groups) {
        // skip hash line but safe the whitespace
        hashLinePrefix = hashLineRegexResult.groups.prefix;
        hashLineSuffix = hashLineRegexResult.groups.suffix;
        return;
      }
      newProviderBlockLines.push(providerBlockLine);
    });

    const hashesWithWhitespace = update.newHashes.map(
      (value) => `${hashLinePrefix}${value}${hashLineSuffix}`,
    );
    newProviderBlockLines.splice(
      // TODO #22198
      update.lineNumbers.hashes.start!,
      0,
      ...hashesWithWhitespace,
    );
    sections.push(newProviderBlockLines);
  });

  const trailingNotUpdatedLines = lines.slice(
    updates.at(-1)!.lineNumbers.block?.end,
  );
  sections.push(trailingNotUpdatedLines);

  const newLines = sections.reduce((previousValue, currentValue) =>
    previousValue.concat(currentValue),
  );
  const newContent = newLines.join('\n');

  return {
    file: {
      type: 'addition',
      path: lockFilePath,
      contents: newContent,
    },
  };
}

const hashicorpVersioning = getVersioning('hashicorp');

// Operators Terraform allows in a version constraint, matched longest-first so
// ">=" wins over ">" and "<=" over "<". The normalization implemented below
// (operator set, boundary-version sort, priority tie-break) mirrors Terraform's
// getproviders.VersionConstraintsString and versionSelectionsBoundaryPriority:
// https://github.com/hashicorp/terraform/blob/main/internal/getproviders/providerreqs/version.go
const constraintOperators = ['>=', '<=', '!=', '~>', '=', '>', '<'];

interface ParsedConstraint {
  raw: string;
  operator: string;
  rawVersion: string;
  cmpVersion: string;
}

// Mirrors Terraform's getproviders.versionSelectionsBoundaryPriority: when two
// constraints share the same boundary version, this decides their relative
// order in the normalized string.
function operatorPriority(operator: string, rawVersion: string): number {
  switch (operator) {
    case '>':
      return 1;
    case '>=':
      return 2;
    case '': // exact pin, serialized without an operator
      return 3;
    case '~>':
      // patch-only (~> x.y.z) sorts before minor-only (~> x.y)
      return rawVersion.split('.').length > 2 ? 4 : 5;
    case '<=':
      return 6;
    case '<':
      return 7;
    case '!=':
      return 8;
    /* v8 ignore next -- unreachable for constraints that parsed successfully */
    default:
      return 0;
  }
}

// Pad the numeric core to three components, matching Terraform's
// VersionSpec.ConstrainToZero so "5.0" and "5.0.0" compare (and dedupe) equal.
function constrainToZero(version: string): string {
  const sep = version.search(regEx(/[-+]/)); // start of prerelease/build metadata, -1 if none
  const core = sep === -1 ? version : version.slice(0, sep);
  const extra = sep === -1 ? '' : version.slice(sep);
  const segments = core.split('.');
  while (segments.length < 3) {
    segments.push('0');
  }
  return segments.join('.') + extra;
}

function parseConstraint(token: string): ParsedConstraint {
  const raw = token.trim();
  for (const operator of constraintOperators) {
    if (raw.startsWith(operator)) {
      const rawVersion = raw.slice(operator.length).trim();
      return {
        raw,
        // Terraform serializes an exact pin without an operator, so treat "="
        // the same as a bare version.
        operator: operator === '=' ? '' : operator,
        rawVersion,
        cmpVersion: constrainToZero(rawVersion),
      };
    }
  }
  return {
    raw,
    operator: '',
    rawVersion: raw,
    cmpVersion: constrainToZero(raw),
  };
}

/**
 * Reorder the sub-constraints of a Terraform lock `constraints` string into the
 * normalized form Terraform/OpenTofu require: boundary version ascending, ties
 * broken by operator priority. Renovate updates a version in place without
 * re-sorting, which produces strings Terraform rejects with "must be written in
 * normalized form" once a bumped exact pin overtakes an inherited `~>` range.
 * See https://github.com/renovatebot/renovate/issues/37273.
 */
export function sortConstraints(
  constraint: string | undefined,
): string | undefined {
  if (!constraint?.includes(',')) {
    return constraint;
  }
  const parsed: ParsedConstraint[] = [];
  for (const token of constraint.split(',')) {
    const entry = parseConstraint(token);
    // Leave the constraint untouched if any token is unrecognizable, rather
    // than risk corrupting it.
    if (!hashicorpVersioning.isValid(entry.cmpVersion)) {
      return constraint;
    }
    parsed.push(entry);
  }
  parsed.sort((a, b) => {
    if (!hashicorpVersioning.equals(a.cmpVersion, b.cmpVersion)) {
      return hashicorpVersioning.isGreaterThan(a.cmpVersion, b.cmpVersion)
        ? 1
        : -1;
    }
    return (
      operatorPriority(a.operator, a.rawVersion) -
      operatorPriority(b.operator, b.rawVersion)
    );
  });
  return parsed.map((entry) => entry.raw).join(', ');
}

export function massageNewValue(value: string | undefined): string | undefined {
  if (isNullOrUndefined(value)) {
    return value;
  }

  const elements = value.split(',');
  const massagedElements: string[] = [];
  for (const element of elements) {
    // these constraints are allowed to miss precision
    if (element.includes('~>')) {
      massagedElements.push(element);
      continue;
    }

    const missing0s = 3 - element.split('.').length;

    let massagedElement = element;

    for (let i = 0; i < missing0s; i++) {
      massagedElement = `${massagedElement}.0`;
    }
    massagedElements.push(massagedElement);
  }

  return massagedElements.join(',');
}
