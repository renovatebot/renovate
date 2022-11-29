import { logger } from '../../../../logger';
import { newlineRegex, regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import type { GradleManagerData } from '../types';

export const VERSIONS_PROPS = 'versions.props';
export const VERSIONS_LOCK = 'versions.lock';

/**
 * Determines if Palantir Gradle consistent-versions is in use, https://github.com/palantir/gradle-consistent-versions.
 * The plugin name must be in build file and both `versions.props` and `versions.lock` must exist.
 *
 * @param availableFiles list of gradle build files found in project
 * @param fileContents map with file contents of all files
 */
export function usesGcv(
  availableFiles: string[],
  fileContents: Record<string, string | null>
): boolean {
  if (
    fileContents['build.gradle']?.includes(
      'com.palantir.consistent-versions'
    ) ||
    fileContents['build.kts']?.includes('com.palantir.consistent-versions')
  ) {
    if (
      availableFiles.includes(VERSIONS_PROPS) &&
      availableFiles.includes(VERSIONS_LOCK)
    ) {
      logger.debug('This repo uses gradle-consistent-versions');
      return true;
    }
  }
  return false;
}

/**
 * Confirms whether the provided file name is one of the two GCV files
 */
export function isGcvPropsFile(fileName: string): boolean {
  return fileName === VERSIONS_PROPS || fileName === VERSIONS_LOCK;
}

/**
 * Parses Gradle-Consistent-Versions files to figure out what dependencies, versions
 * and groups they contain. The parsing goes like this:
 * - Parse `versions.props` into deps (or groups) and versions, remembering file offsets
 * - Parse `versions.lock` into deps and lock-versions
 * - For each exact dep in props file, lookup the lock-version from lock file
 * - For each group/regex dep in props file, lookup the set of exact deps and versions in lock file
 *
 * @param propsFileContent text content of `versions.props
 * @param lockFileContent text content of `versions.lock`
 */
export function parseGcv(
  propsFileContent: string,
  lockFileContent: string
): PackageDependency<GradleManagerData>[] {
  const lockFileMap = parseLockFile(lockFileContent);
  const [propsFileExactMap, propsFileRegexMap] =
    parsePropsFile(propsFileContent);

  const extractedDeps: PackageDependency<GradleManagerData>[] = [];

  // For each exact dep in props file
  for (const [propDep, versionAndPosition] of propsFileExactMap) {
    if (lockFileMap.has(propDep)) {
      const newDep: Record<string, any> = {
        managerData: {
          packageFile: VERSIONS_PROPS,
          fileReplacePosition: versionAndPosition.filePos,
        },
        packageName: propDep,
        currentValue: versionAndPosition.version,
        currentVersion: versionAndPosition.version,
        lockedVersion: lockFileMap.get(propDep),
      } as PackageDependency<GradleManagerData>;
      extractedDeps.push(newDep);
    }
  }

  // For each regular expression (group) dep in props file
  for (const [propDepRegEx, propVerAndPos] of propsFileRegexMap) {
    for (const [exactDep, exactVer] of lockFileMap) {
      if (propDepRegEx.test(exactDep)) {
        const newDep: Record<string, any> = {
          managerData: {
            packageFile: VERSIONS_PROPS,
            fileReplacePosition: propVerAndPos.filePos,
          },
          depName: exactDep,
          currentValue: propVerAndPos.version,
          currentVersion: propVerAndPos.version,
          lockedVersion: exactVer,
          groupName: regexToGroupString(propDepRegEx),
        } as PackageDependency<GradleManagerData>;
        extractedDeps.push(newDep);
      }
    }
  }
  return extractedDeps;
}

//----------------------------------
// Private utility functions below
//----------------------------------

// Translate GCV's glob syntax to regex
function globToRegex(depName: string): RegExp {
  return regEx(depName.replaceAll('.', '\\.').replaceAll('*', '[^:]*'));
}

// Translate the regex from versions.props into a group name used in branch names etc
function regexToGroupString(regExp: RegExp): string {
  return regExp.source.replaceAll('[^:]*', '-').replaceAll('\\.', '.');
}

interface VersionWithPosition {
  version?: string;
  filePos?: number;
}

/**
 * Parses `versions.lock`
 */
function parseLockFile(input: string): Map<string, string> {
  const lockLineRegex = regEx(
    `^(?<depName>[^:]+:[^:]+):(?<lockVersion>[^ ]+) \\(\\d+ constraints: [0-9a-f]+\\)$`
  );

  const depVerMap = new Map<string, string>();
  for (const line of input.split(newlineRegex)) {
    const lineMatch = lockLineRegex.exec(line);
    if (lineMatch?.groups) {
      const { depName, lockVersion } = lineMatch.groups;
      depVerMap.set(depName, lockVersion);
    }
  }
  logger.trace(
    `Found ${depVerMap.size} locked dependencies in ${VERSIONS_LOCK}.`
  );
  return depVerMap;
}

/**
 * Parses `versions.props`
 */
function parsePropsFile(
  input: string
): [Map<string, VersionWithPosition>, Map<RegExp, VersionWithPosition>] {
  const propsLineRegex = regEx(
    `^(?<depName>[^:]+:[^=]+?) *= *(?<propsVersion>.*)$`
  );
  const depVerExactMap = new Map<string, VersionWithPosition>();
  const depVerRegexMap = new Map<RegExp, VersionWithPosition>();

  let startOfLineIdx = 0;
  for (const line of input.split(newlineRegex)) {
    const lineMatch = propsLineRegex.exec(line);
    if (lineMatch?.groups) {
      const { depName, propsVersion } = lineMatch.groups;
      const startPosInLine = line.lastIndexOf(propsVersion);
      const propVersionPos = startOfLineIdx + startPosInLine;
      if (depName.includes('*')) {
        depVerRegexMap.set(globToRegex(depName), {
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
    startOfLineIdx += line.length + 1;
  }
  logger.trace(
    `Found ${depVerExactMap.size} dependencies and ${depVerRegexMap.size} wildcard dependencies in ${VERSIONS_PROPS}.`
  );
  return [depVerExactMap, depVerRegexMap];
}
