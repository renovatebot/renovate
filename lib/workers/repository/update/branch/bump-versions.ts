import { type ReleaseType, inc } from 'semver';
import type { BumpVersionConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { scm } from '../../../../modules/platform/scm';
import { readLocalFile } from '../../../../util/fs';
import { regEx } from '../../../../util/regex';
import { compile } from '../../../../util/template';
import type { BranchConfig } from '../../../types';
import { getFilteredFileList } from '../../extract/file-match';
import type { PostUpgradeCommandsExecutionResult } from './execute-post-upgrade-commands';

export async function bumpVersions(
  config: BranchConfig,
): Promise<PostUpgradeCommandsExecutionResult | null> {
  const result: PostUpgradeCommandsExecutionResult = {
    updatedArtifacts: [],
    artifactErrors: [],
  };

  const bumpVersions = config.bumpVersions;
  if (!bumpVersions) {
    return result;
  }

  const allFiles = await scm.getFileList();
  const fileList = getFilteredFileList(config, allFiles);

  for (const bumpVersionConfig of bumpVersions) {
    const bumpVersionResult = await bumpVersion(
      bumpVersionConfig,
      config,
      fileList,
    );
    if (!bumpVersionResult) {
      continue;
    }
    result.updatedArtifacts.push(...bumpVersionResult.updatedArtifacts);
  }

  return result;
}

async function bumpVersion(
  config: BumpVersionConfig,
  branchConfig: BranchConfig,
  fileList: string[],
): Promise<PostUpgradeCommandsExecutionResult | null> {
  const result: PostUpgradeCommandsExecutionResult = {
    updatedArtifacts: [],
    artifactErrors: [],
  };

  const files: string[] = [];
  try {
    files.push(...getMatchedFiles(config.fileMatch, branchConfig, fileList));
  } catch (e) {
    result.artifactErrors.push({
      stderr: `Failed to calculate matched files for bumpVersions: ${e.message}`,
    });
  }

  // prepare the matchStrings
  const matchStringsRegexes: RegExp[] = [];
  for (const matchString of config.matchStrings) {
    try {
      const templated = compile(matchString, branchConfig);
      matchStringsRegexes.push(regEx(templated));
    } catch (e) {
      result.artifactErrors.push({
        stderr: `Failed to compile matchString for bumpVersions: ${e.message}`,
        fileName: matchString,
      });
    }
  }

  for (const file of files) {
    const fileContents = await readLocalFile(file, 'utf8');
    if (!fileContents) {
      logger.trace({ file }, `bumpVersions: Could not read file`);
      continue;
    }
    for (const matchStringRegex of matchStringsRegexes) {
      const regexResult = matchStringRegex.exec(fileContents);
      if (!regexResult) {
        logger.trace({ file }, `bumpVersions: No match found`);
        continue;
      }
      const version = regexResult.groups?.version;
      if (!version) {
        logger.trace({ file }, `bumpVersions: No version found`);
        continue;
      }

      let newVersion: string | null = null;
      try {
        const bumpType = compile(config.bumpType, branchConfig);
        newVersion = inc(version, bumpType as ReleaseType);
      } catch (e) {
        result.artifactErrors.push({
          stderr: `Failed to bump version: ${e.message}`,
          fileName: file,
        });
      }
      if (!newVersion) {
        logger.debug({ file }, `bumpVersions: Could not bump version`);
        continue;
      }

      // replace the content of the `version` group with newVersion
      const newFileContents: string = fileContents.replace(
        matchStringRegex,
        (match, ...groups) => {
          const { version } = groups.pop();
          return match.replace(version, newVersion);
        },
      );
      if (newFileContents === fileContents) {
        logger.trace({ file }, `bumpVersions: Version was already bumped`);
      } else {
        logger.trace({ file }, `bumpVersions: Bumped version`);
        result.updatedArtifacts.push({
          type: 'addition',
          contents: newFileContents,
          path: file,
        });
      }
    }
  }

  if (result.updatedArtifacts.length === 0) {
    return null;
  }
  return result;
}

/**
 * Get files that match ANY of the fileMatches pattern. fileMatches are compiled with the branchConfig.
 * @param fileMatches list of regex patterns
 * @param branchConfig compile metadata
 * @param fileList list of files to match against
 */
function getMatchedFiles(
  fileMatches: string[],
  branchConfig: BranchConfig,
  fileList: string[],
): string[] {
  // prepare file regex
  const fileMatchRegexes: RegExp[] = [];
  for (const fileMatchElement of fileMatches) {
    const fileMatch = compile(fileMatchElement, branchConfig);
    fileMatchRegexes.push(regEx(fileMatch));
  }
  // get files that match the fileMatch
  const files: string[] = [];
  for (const file of fileList) {
    for (const fileMatchRegex of fileMatchRegexes) {
      if (fileMatchRegex.test(file)) {
        files.push(file);
        break;
      }
    }
  }
  return files;
}
