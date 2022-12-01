import { logger } from '../../../../logger';
import * as fs from '../../../../util/fs';
import { newlineRegex, regEx } from '../../../../util/regex';
import type { PackageDependency } from '../../types';
import type { GradleManagerData } from '../types';

export const VERSIONS_PROPS = 'versions.props';
export const VERSIONS_LOCK = 'versions.lock';

/**
 * Determines if Palantir gradle-consistent-versions is in use, https://github.com/palantir/gradle-consistent-versions.
 * The plugin name must be in build file and both `versions.props` and `versions.lock` must exist.
 *
 * @param versionsPropsFilename is the full file name path of `versions.props`
 * @param fileContents map with file contents of all files
 */
export function usesGcv(
  versionsPropsFilename: string,
  fileContents: Record<string, string | null>
): boolean {
  const buildFileGradle: string = fs.getSiblingFileName(
    versionsPropsFilename,
    'build.gradle'
  );
  const buildFileKts: string = fs.getSiblingFileName(
    versionsPropsFilename,
    'build.gradle.kts'
  );
  const versionsLockFile: string = fs.getSiblingFileName(
    versionsPropsFilename,
    VERSIONS_LOCK
  );
  const gcvPluginName = 'com.palantir.consistent-versions';
  const versionsLockFileExists: boolean =
    fileContents[versionsLockFile] !== undefined;
  const pluginActivated: boolean =
    (fileContents[buildFileGradle]?.includes(gcvPluginName) ?? false) ||
    (fileContents[buildFileKts]?.includes(gcvPluginName) ?? false);

  return versionsLockFileExists && pluginActivated;
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
  fileContents: Record<string, string | null>
): PackageDependency<GradleManagerData>[] {
  const propsFileContent = fileContents[propsFileName] ?? '';
  const lockFileName = fs.getSiblingFileName(propsFileName, VERSIONS_LOCK);
  const lockFileContent = fileContents[lockFileName] ?? '';
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

// Translate glob syntax to a regex that does the same
function globToRegex(depName: string): RegExp {
  return regEx(
    depName
      .replaceAll('*', '_WC_CHAR_')
      .replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')
      .replaceAll('_WC_CHAR_', '[^:]*')
  );
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
