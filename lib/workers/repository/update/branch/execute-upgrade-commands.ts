import minimatch from 'minimatch';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { getRepoStatus } from '../../../../util/git';
import type { FileChange } from '../../../../util/git/types';

export async function updateUpdatedArtifacts(
  fileFilters: string[],
  updatedArtifacts: FileChange[],
  taskType: string
): Promise<FileChange[]> {
  const status = await getRepoStatus();
  let updatedUpdatedArtifacts = updatedArtifacts;

  for (const relativePath of status.modified.concat(status.not_added)) {
    for (const pattern of fileFilters) {
      if (minimatch(relativePath, pattern)) {
        logger.debug({ file: relativePath, pattern }, taskType + ' file saved');
        const existingContent = await readLocalFile(relativePath);
        const existingUpdatedArtifacts = updatedUpdatedArtifacts.find(
          (ua) => ua.path === relativePath
        );
        if (existingUpdatedArtifacts?.type === 'addition') {
          existingUpdatedArtifacts.contents = existingContent;
        } else {
          updatedUpdatedArtifacts.push({
            type: 'addition',
            path: relativePath,
            contents: existingContent,
          });
        }
        // If the file is deleted by a previous update command, remove the deletion from updatedArtifacts
        updatedUpdatedArtifacts = updatedUpdatedArtifacts.filter(
          (ua) => !(ua.type === 'deletion' && ua.path === relativePath)
        );
      }
    }
  }

  for (const relativePath of status.deleted || []) {
    for (const pattern of fileFilters) {
      if (minimatch(relativePath, pattern)) {
        logger.debug(
          { file: relativePath, pattern },
          taskType + ' file removed'
        );
        updatedUpdatedArtifacts.push({
          type: 'deletion',
          path: relativePath,
        });
        // If the file is created or modified by a previous update command, remove the modification from updatedArtifacts
        updatedUpdatedArtifacts = updatedUpdatedArtifacts.filter(
          (ua) => !(ua.type === 'addition' && ua.path === relativePath)
        );
      }
    }
  }

  return updatedUpdatedArtifacts;
}
