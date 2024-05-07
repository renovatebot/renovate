import { logger } from '../../../../logger';
import * as fs from '../../../../util/fs';
import { newlineRegex, regEx } from '../../../../util/regex';
import { coerceString } from '../../../../util/string';
import type { PackageDependency } from '../../types';
import type { GradleManagerData } from '../types';
import { isDependencyString, versionLikeSubstring } from '../utils';

export const VERSIONS_PROPS = 'versions.props';
export const VERSIONS_LOCK = 'versions.lock';
export const LOCKFIlE_HEADER_TEXT = regEx(
  /^# Run \.\/gradlew (?:--write-locks|writeVersionsLock) to regenerate this file/,
);

/**
 * Determines if Palantir gradle-consistent-versions is in use, https://github.com/palantir/gradle-consistent-versions.
 * Both `versions.props` and `versions.lock` must exist and the special header line of lock file must match
 *
 * @param versionsPropsFilename is the full file name path of `versions.props`
 * @param fileContents map with file contents of all files
 */
export function usesGcv(
  versionsPropsFilename: string,
  fileContents: Record<string, string | null>,
): boolean {
  const versionsLockFile: string = fs.getSiblingFileName(
    versionsPropsFilename,
    VERSIONS_LOCK,
  );

  return !!fileContents[versionsLockFile]?.match(LOCKFIlE_HEADER_TEXT);
}

/**
 * Confirms whether the provided file name is the props file
 */
export function isGcvPropsFile(fileName: string): boolean {
  return fileName === VERSIONS_PROPS || fileName.endsWith(`/${VERSIONS_PROPS}`);
}

/**
 * Confirms whether the provided file name is the lock file
 */
export function isGcvLockFile(fileName: string): boolean {
  return fileName === VERSIONS_LOCK || fileName.endsWith(`/${VERSIONS_LOCK}`);
}

/**
 * Parses Gradle-Consistent-Versions files to figure out what dependencies, versions
 * and groups they contain. The parsing goes like this:
 * - Parse `versions.props` into deps (or groups) and versions, remembering file offsets
 * - Parse `versions.lock` into deps and lock-versions
 * - For each exact dep in props file, lookup the lock-version from lock file
 * - For each group/regex dep in props file, lookup the set of exact deps and versions in lock file
 *
 * @param propsFileName name and path of the props file
 * @param fileContents text content of all files
 */
export function parseGcv(
  propsFileName: string,
  fileContents: Record<string, string | null>,
): PackageDependency<GradleManagerData>[] {
  const propsFileContent = coerceString(fileContents[propsFileName]);
  const lockFileName = fs.getSiblingFileName(propsFileName, VERSIONS_LOCK);
  const lockFileContent = coerceString(fileContents[lockFileName]);
  const lockFileMap = parseLockFile(lockFileContent);
  const [propsFileExactMap, propsFileRegexMap] =
    parsePropsFile(propsFileContent);

  const extractedDeps: PackageDependency<GradleManagerData>[] = [];

  // For each exact dep in props file
  for (const [propDep, versionAndPosition] of propsFileExactMap) {
    if (lockFileMap.has(propDep)) {
      const newDep: Record<string, any> = {
        managerData: {
          packageFile: propsFileName,
          fileReplacePosition: versionAndPosition.filePos,
        },
        depName: propDep,
        currentValue: versionAndPosition.version,
        lockedVersion: lockFileMap.get(propDep)?.version,
        depType: lockFileMap.get(propDep)?.depType,
      } satisfies PackageDependency<GradleManagerData>;
      extractedDeps.push(newDep);
      // Remove from the lockfile map so the same exact lib will not be included in globbing
      lockFileMap.delete(propDep);
    }
  }

  // For each regular expression dep in props file (starting with the longest glob string)...
  for (const [propDepGlob, propVerAndPos] of propsFileRegexMap) {
    const globRegex = globToRegex(propDepGlob);
    for (const [exactDep, lockVersionAndDepType] of lockFileMap) {
      if (globRegex.test(exactDep)) {
        const newDep: Record<string, any> = {
          managerData: {
            packageFile: propsFileName,
            fileReplacePosition: propVerAndPos.filePos,
          },
          depName: exactDep,
          currentValue: propVerAndPos.version,
          lockedVersion: lockVersionAndDepType.version,
          depType: lockVersionAndDepType.depType,
          groupName: propDepGlob,
        } satisfies PackageDependency<GradleManagerData>;
        extractedDeps.push(newDep);
        // Remove from the lockfile map so the same lib will not be included in more generic globs later
        lockFileMap.delete(exactDep);
      }
    }
  }
  return extractedDeps;
}

// Translate glob syntax to a regex that does the same. Note that we cannot use replaceAll as it does not exist in Node14
// Loosely borrowed mapping to regex from https://github.com/palantir/gradle-consistent-versions/blob/develop/src/main/java/com/palantir/gradle/versions/FuzzyPatternResolver.java
function globToRegex(depName: string): RegExp {
  return regEx(
    depName
      .replace(/\*/g, '_WC_CHAR_')
      .replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')
      .replace(/_WC_CHAR_/g, '.*?'),
  );
}

interface VersionWithPosition {
  version: string;
  filePos: number;
}

interface VersionWithDepType {
  version: string;
  depType: string;
}

/**
 * Parses `versions.lock`
 */
export function parseLockFile(input: string): Map<string, VersionWithDepType> {
  const lockLineRegex = regEx(
    `^(?<depName>[^:]+:[^:]+):(?<lockVersion>[^ ]+) \\(\\d+ constraints: [0-9a-f]+\\)$`,
  );

  const depVerMap = new Map<string, VersionWithDepType>();
  let isTestDepType = false;
  for (const line of input.split(newlineRegex)) {
    const lineMatch = lockLineRegex.exec(line);
    if (lineMatch?.groups) {
      const { depName, lockVersion } = lineMatch.groups;
      if (isDependencyString(`${depName}:${lockVersion}`)) {
        depVerMap.set(depName, {
          version: lockVersion,
          depType: isTestDepType ? 'test' : 'dependencies',
        } as VersionWithDepType);
      }
    } else if (line === '[Test dependencies]') {
      isTestDepType = true; // We know that all lines below this header are test dependencies
    }
  }
  logger.trace(
    `Found ${depVerMap.size} locked dependencies in ${VERSIONS_LOCK}.`,
  );
  return depVerMap;
}

/**
 * Parses `versions.props`, this is CR/LF safe
 * @param input the entire property file from file system
 * @return two maps, first being exact matches, second regex matches
 */
export function parsePropsFile(
  input: string,
): [Map<string, VersionWithPosition>, Map<string, VersionWithPosition>] {
  const propsLineRegex = regEx(
    `^(?<depName>[^:]+:[^=]+?) *= *(?<propsVersion>.*)$`,
  );
  const depVerExactMap = new Map<string, VersionWithPosition>();
  const depVerRegexMap = new Map<string, VersionWithPosition>();

  let startOfLineIdx = 0;
  const isCrLf = input.indexOf('\r\n') > 0;
  const validGlob = /^[a-zA-Z][-_a-zA-Z0-9.:*]+$/;
  for (const line of input.split(newlineRegex)) {
    const lineMatch = propsLineRegex.exec(line);
    if (lineMatch?.groups) {
      const { depName, propsVersion } = lineMatch.groups;
      if (
        validGlob.test(depName) &&
        versionLikeSubstring(propsVersion) !== null
      ) {
        const startPosInLine = line.lastIndexOf(propsVersion);
        const propVersionPos = startOfLineIdx + startPosInLine;
        if (depName.includes('*')) {
          depVerRegexMap.set(depName, {
            version: propsVersion,
            filePos: propVersionPos,
          });
        } else {
          depVerExactMap.set(depName, {
            version: propsVersion,
            filePos: propVersionPos,
          });
        }
      }
    }
    startOfLineIdx += line.length + (isCrLf ? 2 : 1);
  }
  logger.trace(
    `Found ${depVerExactMap.size} dependencies and ${depVerRegexMap.size} wildcard dependencies in ${VERSIONS_PROPS}.`,
  );
  return [depVerExactMap, new Map([...depVerRegexMap].sort().reverse())];
}
