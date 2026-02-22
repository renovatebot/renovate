import type { RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { minimatch } from '../../../util/minimatch.ts';
import { matchRegexOrGlob } from '../../../util/string-match.ts';

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
  const { managerFilePatterns, manager } = config;
  let matchedFiles: string[] = [];
  // TODO: types (#22198)
  for (const pattern of managerFilePatterns!) {
    logger.debug(`Using file pattern: ${pattern} for manager ${manager!}`);
    matchedFiles = matchedFiles.concat(
      fileList.filter((file) => matchRegexOrGlob(file, pattern)),
    );
  }
  // filter out duplicates
  return [...new Set(matchedFiles)].sort();
}
