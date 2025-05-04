import { type ReleaseType, inc } from 'semver';
import type { BumpVersionConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { coerceArray } from '../../../../util/array';
import { readLocalFile } from '../../../../util/fs';
import type {
  FileAddition,
  FileChange,
  FileDeletion,
} from '../../../../util/git/types';
import { regEx } from '../../../../util/regex';
import { matchRegexOrGlobList } from '../../../../util/string-match';
import { compile } from '../../../../util/template';
import type { BranchConfig } from '../../../types';
import { getFilteredFileList } from '../../extract/file-match';

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
      packageFileChanges.additions,
      artifactFileChanges.additions,
    );
  }

  // update the config with the new files
  config.updatedPackageFiles = [
    ...Object.values(packageFileChanges.additions),
    ...Object.values(packageFileChanges.deletions),
  ];
  config.updatedArtifacts = [
    ...Object.values(artifactFileChanges.additions),
    ...Object.values(artifactFileChanges.deletions),
  ];
}

async function bumpVersion(
  config: BumpVersionConfig,
  branchConfig: BranchConfig,
  fileList: string[],
  packageFiles: Record<string, FileAddition>,
  artifactFiles: Record<string, FileAddition>,
): Promise<void> {
  const bumpVersionsDescr = config.name
    ? `bumpVersions(${config.name})`
    : 'bumpVersions';

  const files: string[] = [];
  try {
    files.push(...getMatchedFiles(config.filePatterns, branchConfig, fileList));
  } catch (e) {
    addArtifactError(
      branchConfig,
      `Failed to calculate matched files for bumpVersions: ${e.message}`,
    );
  }
  // prepare the matchStrings
  const matchStringsRegexes: RegExp[] = [];
  for (const matchString of config.matchStrings) {
    try {
      const templated = compile(matchString, branchConfig);
      matchStringsRegexes.push(regEx(templated));
    } catch (e) {
      addArtifactError(
        branchConfig,
        `Failed to compile matchString for ${bumpVersionsDescr}: ${e.message}`,
        matchString,
      );
    }
  }

  for (const file of files) {
    // getting the already modified file contents or read the file directly
    let fileContents: string | null | undefined =
      packageFiles[file]?.contents?.toString();
    fileContents ??= artifactFiles[file]?.contents?.toString();
    fileContents ??= await readLocalFile(file, 'utf8');
    if (!fileContents) {
      logger.warn({ file }, `${bumpVersionsDescr}: Could not read file`);
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
        logger.debug({ file }, `${bumpVersionsDescr}: No version found`);
        continue;
      }

      // getting new version
      let newVersion: string | null = null;
      try {
        const bumpType = compile(config.bumpType, branchConfig);
        newVersion = inc(version, bumpType as ReleaseType);
      } catch (e) {
        addArtifactError(
          branchConfig,
          `Failed to calculate new version for ${bumpVersionsDescr}: ${e.message}`,
          file,
        );
      }
      if (!newVersion) {
        logger.debug({ file }, `${bumpVersionsDescr}: Could not bump version`);
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
      if (packageFiles[file]) {
        packageFiles[file] = {
          ...packageFiles[file],
          type: 'addition',
          contents: newFileContents,
        };
      } else if (artifactFiles[file]) {
        artifactFiles[file] = {
          ...artifactFiles[file],
          type: 'addition',
          contents: newFileContents,
        };
      } else {
        artifactFiles[file] = {
          type: 'addition',
          contents: newFileContents,
          path: file,
        };
      }
    }
  }
}

/**
 * Get files that match ANY of the fileMatches pattern. fileMatches are compiled with the branchConfig.
 * @param filePatternTemplates list of regex patterns
 * @param branchConfig compile metadata
 * @param fileList list of files to match against
 */
function getMatchedFiles(
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
  // get files that match the fileMatch
  const files: string[] = [];
  for (const file of fileList) {
    if (matchRegexOrGlobList(file, filePatterns)) {
      files.push(file);
    }
  }
  return files;
}

function fileChangeListToMap(list: FileChange[] | undefined): {
  additions: Record<string, FileAddition>;
  deletions: Record<string, FileDeletion>;
} {
  const additions: Record<string, FileAddition> = {};
  const deletions: Record<string, FileDeletion> = {};
  for (const fileChange of coerceArray(list)) {
    if (fileChange.type === 'addition') {
      additions[fileChange.path] = fileChange;
    } else {
      deletions[fileChange.path] = fileChange;
    }
  }
  return { additions, deletions };
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
