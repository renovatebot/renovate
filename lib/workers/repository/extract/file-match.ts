import minimatch from 'minimatch';
import { logger } from '../../../logger';

export function getIncludedFiles(
  fileList: string[],
  includePaths: string[]
): string[] {
  if (!(includePaths && includePaths.length)) {
    return [...fileList];
  }
  return fileList.filter((file) =>
    includePaths.some(
      (includePath) =>
        file === includePath || minimatch(file, includePath, { dot: true })
    )
  );
}

export function filterIgnoredFiles(
  fileList: string[],
  ignorePaths: string[]
): string[] {
  if (!(ignorePaths && ignorePaths.length)) {
    return [...fileList];
  }
  return fileList.filter(
    (file) =>
      !ignorePaths.some(
        (ignorePath) =>
          file.includes(ignorePath) ||
          minimatch(file, ignorePath, { dot: true })
      )
  );
}

export function getMatchingFiles(
  fileList: string[],
  manager: string,
  fileMatch: string[]
): string[] {
  let matchedFiles = [];
  for (const match of fileMatch) {
    logger.debug(`Using file match: ${match} for manager ${manager}`);
    const re = new RegExp(match);
    matchedFiles = matchedFiles.concat(
      fileList.filter((file) => re.test(file))
    );
  }
  // filter out duplicates
  return [...new Set(matchedFiles)];
}
