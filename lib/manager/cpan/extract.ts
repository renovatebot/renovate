import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { readLocalFile } from '../../util/fs';
import { regEx } from '../../util/regex';
import { PackageDependency, PackageFile } from '../common';

export async function extractPackageFile(
  content: string,
  fileName?: string
): Promise<PackageFile | null> {
  const res: PackageFile = {
    registryUrls: [],
    deps: [],
  };

  const lines = content.split('\n');
  const delimiters = ['"', "'"];
  const commaRegex = '(?:,|=>)';

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    let requiresMatch: RegExpMatchArray;

    for (const delimiter of delimiters) {
      // TODO: The version number may not have a delimiter
      const requiresMatchRegex = `^requires ${delimiter}([^${delimiter}]+)${delimiter}\\s*${commaRegex}\\s*${delimiter}([^${delimiter}]+)${delimiter}`;

      if (regEx(requiresMatchRegex).test(line)) {
        requiresMatch = requiresMatch || regEx(requiresMatchRegex).exec(line);
      }
    }

    // if `requires` exists
    if (requiresMatch) {
      const dep: PackageDependency = {
        depName: requiresMatch[1],
        managerData: { lineNumber },
      };

      // if version declaration exists
      if (requiresMatch[2]) {
        dep.currentValue = requiresMatch[2];
      } else {
        dep.skipReason = SkipReason.NoVersion;
      }

      if (!dep.skipReason) {
        dep.datasource = 'metacpan'; // TODO: module
      }

      res.deps.push(dep);
    }
  }

  if (!res.deps.length && !res.registryUrls.length) {
    return null;
  }

  if (fileName) {
    const cpanfileSnapshot = `${fileName}.snapshot`;
    const snapshotContent = await readLocalFile(cpanfileSnapshot, 'utf8');

    if (snapshotContent) {
      logger.debug({ packageFile: fileName }, 'Found cpanfile.snapshot file');
      // TODO: do something
    }
  }

  logger.debug(JSON.stringify(res));

  return res;
}
