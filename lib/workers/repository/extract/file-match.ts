import minimatch from 'minimatch';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import type { WorkerExtractConfig } from '../../types';

export function getIncludedFiles(
  fileList: string[],
  includePaths: string[]
): string[] {
  if (!includePaths?.length) {
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
  if (!ignorePaths?.length) {
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

export function getFilteredFileList(
  config: WorkerExtractConfig,
  fileList: string[]
): string[] {
  const { includePaths, ignorePaths } = config;
  // TODO #7154
  let filteredList = getIncludedFiles(fileList, includePaths!);
  filteredList = filterIgnoredFiles(filteredList, ignorePaths!);
  return filteredList;
}

export function getMatchingFiles(
  config: WorkerExtractConfig,
  allFiles: string[]
): string[] {
  const fileList = getFilteredFileList(config, allFiles);
  const { fileMatch, manager } = config;
  let matchedFiles: string[] = [];
  for (const match of fileMatch ?? []) {
    logger.debug(`Using file match: ${match} for manager ${manager}`);
    const re = regEx(match);
    matchedFiles = matchedFiles.concat(
      fileList.filter((file) => re.test(file))
    );
  }
  // filter out duplicates
  return [...new Set(matchedFiles)].sort();
}
