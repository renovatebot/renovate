import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { minimatch } from '../../../util/minimatch';
import { regEx } from '../../../util/regex';

export function getIncludedFiles(
  fileList: string[],
  includePaths: string[],
): string[] {
  if (!includePaths?.length) {
    return [...fileList];
  }
  return fileList.filter((file) =>
    includePaths.some(
      (includePath) =>
        file === includePath ||
        minimatch(includePath, { dot: true }).match(file),
    ),
  );
}

export function filterIgnoredFiles(
  fileList: string[],
  ignorePaths: string[],
): string[] {
  if (!ignorePaths?.length) {
    return [...fileList];
  }
  return fileList.filter(
    (file) =>
      !ignorePaths.some(
        (ignorePath) =>
          file.includes(ignorePath) ||
          minimatch(ignorePath, { dot: true }).match(file),
      ),
  );
}

export function getFilteredFileList(
  config: RenovateConfig,
  fileList: string[],
): string[] {
  const { includePaths, ignorePaths } = config;
  // TODO #22198

  let filteredList = getIncludedFiles(fileList, includePaths!);
  filteredList = filterIgnoredFiles(filteredList, ignorePaths!);
  return filteredList;
}

export function getMatchingFiles(
  config: RenovateConfig,
  allFiles: string[],
): string[] {
  const fileList = getFilteredFileList(config, allFiles);
  const { fileMatch, manager } = config;
  let matchedFiles: string[] = [];
  // TODO: types (#22198)
  for (const match of fileMatch!) {
    logger.debug(`Using file match: ${match} for manager ${manager!}`);
    const re = regEx(match);
    matchedFiles = matchedFiles.concat(
      fileList.filter((file) => re.test(file)),
    );
  }
  // filter out duplicates
  return [...new Set(matchedFiles)].sort();
}
