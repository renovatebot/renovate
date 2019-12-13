import minimatch from 'minimatch';
import { logger } from '../../../logger';

export function getIncludedFiles(
  fileList: string[],
  includePaths: string[]
): string[] {
  if (!(includePaths && includePaths.length)) {
    return fileList;
  }
  return fileList.filter(file =>
    includePaths.some(
      includePath =>
        file === includePath || minimatch(file, includePath, { dot: true })
    )
  );
}

export function filterIgnoredFiles(
  fileList: string[],
  ignorePaths: string[]
): string[] {
  if (!(ignorePaths && ignorePaths.length)) {
    return fileList;
  }
  return fileList.filter(
    file =>
      !ignorePaths.some(
        ignorePath =>
          file.includes(ignorePath) ||
          minimatch(file, ignorePath, { dot: true })
      )
  );
}

export function getMatchingFiles(
  fileList: string[],
  manager: string,
  fileMatchList: string[]
): string[] {
  let matchedFiles = [];
  for (const fileMatch of fileMatchList) {
    logger.debug(`Using file match: ${fileMatch} for manager ${manager}`);
    matchedFiles = matchedFiles.concat(
      fileList.filter(file => file.match(new RegExp(fileMatch)))
    );
  }
  // filter out duplicates
  return [...new Set(matchedFiles)];
}
