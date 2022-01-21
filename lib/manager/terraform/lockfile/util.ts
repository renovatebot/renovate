import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { get as getVersioning } from '../../../versioning';
import type { UpdateArtifactsResult } from '../../types';
import type {
  LineNumbers,
  ProviderLock,
  ProviderLockUpdate,
  ProviderSlice,
} from './types';

const providerStartLineRegex = regEx(
  `^provider "(?<registryUrl>[^/]*)\\/(?<namespace>[^/]*)\\/(?<depName>[^/]*)"`
);
const versionLineRegex = regEx(
  `^(?<prefix>[\\s]*version[\\s]*=[\\s]*")(?<version>[^"']+)(?<suffix>".*)$`
);
const constraintLineRegex = regEx(
  `^(?<prefix>[\\s]*constraints[\\s]*=[\\s]*")(?<constraint>[^"']+)(?<suffix>".*)$`
);
const hashLineRegex = regEx(`^(?<prefix>\\s*")(?<hash>[^"]+)(?<suffix>",.*)$`);

const lockFile = '.terraform.lock.hcl';

export function findLockFile(packageFilePath: string): string {
  return getSiblingFileName(packageFilePath, lockFile);
}

export function readLockFile(lockFilePath: string): Promise<string> {
  return readLocalFile(lockFilePath, 'utf8');
}

export function extractLocks(lockFileContent: string): ProviderLock[] {
  const lines = lockFileContent.split('\n');
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
    let lookupName = '';
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
    const hashes = [];

    slice.lines.forEach((line, index) => {
      const hashLineResult = hashLineRegex.exec(line);
      if (hashLineResult) {
        hashes.push(hashLineResult.groups.hash);
        relativeLineNumbers.hashes.start =
          relativeLineNumbers.hashes.start === -1
            ? index
            : relativeLineNumbers.hashes.start;
        relativeLineNumbers.hashes.end = index;
        return;
      }

      const providerStartLineResult = providerStartLineRegex.exec(line);
      if (providerStartLineResult) {
        lookupName = `${providerStartLineResult.groups.namespace}/${providerStartLineResult.groups.depName}`;
        registryUrl = providerStartLineResult.groups.registryUrl;
        return;
      }

      const versionLineResult = versionLineRegex.exec(line);
      if (versionLineResult) {
        version = versionLineResult.groups.version;
        relativeLineNumbers.version = index;
        return;
      }

      const constraintLineResult = constraintLineRegex.exec(line);
      if (constraintLineResult) {
        constraints = constraintLineResult.groups.constraint;
        relativeLineNumbers.constraint = index;
      }
    });

    const lock: ProviderLock = {
      lookupName,
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

export function isPinnedVersion(value: string): boolean {
  const versioning = getVersioning('hashicorp');
  return !!versioning.isSingleVersion(value);
}

export function writeLockUpdates(
  updates: ProviderLockUpdate[],
  lockFilePath: string,
  oldLockFileContent: string
): UpdateArtifactsResult {
  const lines = oldLockFileContent.split('\n');

  const sections: string[][] = [];

  // sort updates in order of appearance in the lockfile
  updates.sort((a, b) => a.lineNumbers.block.start - b.lineNumbers.block.start);
  updates.forEach((update, index, array) => {
    // re add leading whitespace
    let startWhitespace;
    if (index > 0) {
      // get end of the
      startWhitespace = array[index - 1].lineNumbers.block.end;
    }
    const leadingNonRelevantLines = lines.slice(
      startWhitespace,
      update.lineNumbers.block.start
    );
    sections.push(leadingNonRelevantLines);

    const providerBlockLines = lines.slice(
      update.lineNumbers.block.start,
      update.lineNumbers.block.end
    );
    const newProviderBlockLines: string[] = [];
    let hashLinePrefix = '';
    let hashLineSuffix = '';
    providerBlockLines.forEach((providerBlockLine, providerBlockIndex) => {
      const versionLine = providerBlockLine.replace(
        versionLineRegex,
        `$<prefix>${update.newVersion}$<suffix>`
      );
      if (versionLine !== providerBlockLine) {
        newProviderBlockLines.push(versionLine);
        return;
      }

      const constraintLine = providerBlockLine.replace(
        constraintLineRegex,
        `$<prefix>${update.newConstraint}$<suffix>`
      );
      if (constraintLine !== providerBlockLine) {
        newProviderBlockLines.push(constraintLine);
        return;
      }

      const hashLineRegexResult = hashLineRegex.exec(providerBlockLine);
      if (hashLineRegexResult) {
        // skip hash line but safe the whitespace
        hashLinePrefix = hashLineRegexResult.groups.prefix;
        hashLineSuffix = hashLineRegexResult.groups.suffix;
        return;
      }
      newProviderBlockLines.push(providerBlockLine);
    });
    const hashesWithWhitespace = update.newHashes.map(
      (value) => `${hashLinePrefix}${value}${hashLineSuffix}`
    );
    newProviderBlockLines.splice(
      update.lineNumbers.hashes.start,
      0,
      ...hashesWithWhitespace
    );
    sections.push(newProviderBlockLines);
  });

  const trailingNotUpdatedLines = lines.slice(
    updates[updates.length - 1].lineNumbers.block.end
  );
  sections.push(trailingNotUpdatedLines);

  const newLines = sections.reduce((previousValue, currentValue) =>
    previousValue.concat(currentValue)
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
