import { type ReleaseType, inc } from 'semver';
import type { BumpVersionConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { coerceArray } from '../../../../util/array';
import { readLocalFile } from '../../../../util/fs';
import type { FileChange } from '../../../../util/git/types';
import { regEx } from '../../../../util/regex';
import { matchRegexOrGlobList } from '../../../../util/string-match';
import { compile } from '../../../../util/template';
import type { BranchConfig } from '../../../types';
import { getFilteredFileList } from '../../extract/file-match';

type ParseFileChangesResult =
  | { state: 'modified'; content: string | null }
  | { state: 'deleted' }
  | { state: 'unmodified' };

export async function bumpVersions(config: BranchConfig): Promise<void> {
  const bumpVersions = config.bumpVersions;
  if (!bumpVersions?.length) {
    return;
  }

  // skip if no packageFiles or artifacts have been updated
  if (!config.updatedPackageFiles?.length && !config.updatedArtifacts?.length) {
    return;
  }

  const allFiles = await scm.getFileList();
  const fileList = getFilteredFileList(config, allFiles);

  const packageFileChanges = fileChangeListToMap(config.updatedPackageFiles);
  const artifactFileChanges = fileChangeListToMap(config.updatedArtifacts);

  for (const bumpVersionConfig of bumpVersions) {
    await bumpVersion(
      bumpVersionConfig,
      config,
      fileList,
      packageFileChanges,
      artifactFileChanges,
    );
  }

  // update the config with the new files
  config.updatedPackageFiles = Object.values(packageFileChanges).flat();
  config.updatedArtifacts = Object.values(artifactFileChanges).flat();
}

async function bumpVersion(
  config: BumpVersionConfig,
  branchConfig: BranchConfig,
  fileList: string[],
  packageFiles: Record<string, FileChange[]>,
  artifactFiles: Record<string, FileChange[]>,
): Promise<void> {
  const rawBumpType = config.bumpType ?? 'patch';

  // all log messages should be prefixed with this string to facilitate easier logLevelRemapping
  const bumpVersionsDescr = config.name
    ? `bumpVersions(${config.name})`
    : 'bumpVersions';

  const files: string[] = [];
  try {
    files.push(
      ...getMatchedFiles(
        bumpVersionsDescr,
        config.filePatterns,
        branchConfig,
        fileList,
      ),
    );
  } catch (e) {
    addArtifactError(
      branchConfig,
      `Failed to calculate matched files for bumpVersions: ${e.message}`,
    );
    return;
  }

  if (!files.length) {
    logger.debug(`${bumpVersionsDescr}: filePatterns did not match any files`);
    return;
  }

  logger.trace(
    { files },
    `${bumpVersionsDescr}: Found ${files.length} files to bump versions`,
  );

  // keeping this only for logging purposes
  const matchStrings: string[] = [];

  // prepare the matchStrings
  const matchStringsRegexes: RegExp[] = [];
  for (const matchString of config.matchStrings) {
    try {
      const templated = compile(matchString, branchConfig);
      matchStrings.push(templated);
      matchStringsRegexes.push(regEx(templated));
    } catch (e) {
      addArtifactError(
        branchConfig,
        `Failed to compile matchString for ${bumpVersionsDescr}: ${e.message}`,
        matchString,
      );
    }
  }

  logger.trace({ matchStrings }, `${bumpVersionsDescr}: Compiled matchStrings`);

  for (const filePath of files) {
    let fileBumped = false;

    const fileContents = await getFileContent(
      bumpVersionsDescr,
      filePath,
      packageFiles,
      artifactFiles,
    );
    if (!fileContents) {
      continue;
    }

    for (const matchStringRegex of matchStringsRegexes) {
      // extracting the version from the file
      const regexResult = matchStringRegex.exec(fileContents);
      if (!regexResult) {
        continue;
      }
      const version = regexResult.groups?.version;
      if (!version) {
        logger.debug(
          { file: filePath },
          `${bumpVersionsDescr}: No version found`,
        );
        continue;
      }

      // getting new version
      let newVersion: string | null = null;
      try {
        const bumpType = compile(rawBumpType, branchConfig);
        newVersion = inc(version, bumpType as ReleaseType);
      } catch (e) {
        addArtifactError(
          branchConfig,
          `Failed to calculate new version for ${bumpVersionsDescr}: ${e.message}`,
          filePath,
        );
      }
      if (!newVersion) {
        logger.debug(
          { file: filePath },
          `${bumpVersionsDescr}: Could not bump version`,
        );
        continue;
      }

      // replace the content of the `version` group with newVersion
      const newFileContents: string = fileContents
        .toString()
        .replace(matchStringRegex, (match, ...groups) => {
          const { version } = groups.pop();
          return match.replace(version, newVersion);
        });

      // update the file. Add it to the buckets if exists or create a new artifact update
      if (packageFiles[filePath]) {
        packageFiles[filePath].push({
          type: 'addition',
          path: filePath,
          contents: newFileContents,
        });
      } else {
        artifactFiles[filePath] ??= [];
        artifactFiles[filePath].push({
          type: 'addition',
          path: filePath,
          contents: newFileContents,
        });
      }

      fileBumped = true;
    }

    if (!fileBumped) {
      logger.debug(
        { file: filePath },
        `${bumpVersionsDescr}: No match found for bumping version`,
      );
    }
  }
}

/**
 * Get files that match ANY of the fileMatches pattern. fileMatches are compiled with the branchConfig.
 * @param bumpVersionsDescr log description for the bump version config
 * @param filePatternTemplates list of regex patterns
 * @param branchConfig compile metadata
 * @param fileList list of files to match against
 */
function getMatchedFiles(
  bumpVersionsDescr: string,
  filePatternTemplates: string[],
  branchConfig: BranchConfig,
  fileList: string[],
): string[] {
  // prepare file regex
  const filePatterns: string[] = [];
  for (const filePatternTemplateElement of filePatternTemplates) {
    const filePattern = compile(filePatternTemplateElement, branchConfig);
    filePatterns.push(filePattern);
  }

  logger.trace({ filePatterns }, `${bumpVersionsDescr}: Compiled filePatterns`);

  // get files that match the fileMatch
  const files: string[] = [];
  for (const file of fileList) {
    if (matchRegexOrGlobList(file, filePatterns)) {
      files.push(file);
    }
  }
  return files;
}

function fileChangeListToMap(
  list: FileChange[] | undefined,
): Record<string, FileChange[]> {
  const record: Record<string, FileChange[]> = {};
  for (const fileChange of coerceArray(list)) {
    record[fileChange.path] ??= [];
    record[fileChange.path].push(fileChange);
  }
  return record;
}

function addArtifactError(
  branchConfig: BranchConfig,
  message: string,
  fileName?: string,
): void {
  branchConfig.artifactErrors ??= [];
  branchConfig.artifactErrors.push({
    stderr: message,
    fileName,
  });
}

async function getFileContent(
  bumpVersionsDescr: string,
  filePath: string,
  packageFiles: Record<string, FileChange[]>,
  artifactFiles: Record<string, FileChange[]>,
): Promise<string | null> {
  const packageFileChanges = parseFileChanges(filePath, packageFiles);
  const artifactFileChanges = parseFileChanges(filePath, artifactFiles);

  // skip if the file is deleted as it virtually doesn't exist
  if (
    packageFileChanges.state === 'deleted' ||
    artifactFileChanges.state === 'deleted'
  ) {
    return null;
  }

  if (packageFileChanges.state === 'modified') {
    const lastChange = packageFileChanges.content;
    if (lastChange) {
      return lastChange;
    }
  }
  if (artifactFileChanges.state === 'modified') {
    const lastChange = artifactFileChanges.content;
    if (lastChange) {
      return lastChange;
    }
  }

  try {
    return await readLocalFile(filePath, 'utf8');
  } catch (e) {
    logger.warn(
      { file: filePath },
      `${bumpVersionsDescr}: Could not read file: ${e.message}`,
    );
    return null;
  }
}

function parseFileChanges(
  filePath: string,
  changeRecord: Record<string, FileChange[]>,
): ParseFileChangesResult {
  const changes = coerceArray(changeRecord[filePath]);

  // skip if we can fetch from record
  if (!changes.length) {
    return { state: 'unmodified' };
  }

  const lastChange = changes[changes.length - 1];
  if (lastChange.type === 'deletion') {
    return { state: 'deleted' };
  }
  return {
    state: 'modified',
    content: lastChange.contents?.toString() ?? null,
  };
}
