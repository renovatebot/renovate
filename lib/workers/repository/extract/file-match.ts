import minimatch from 'minimatch';
import { RenovateConfig } from '../../../config/common';
import { logger } from '../../../logger';
import { platform } from '../../../platform';

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

export function getFileList(): Promise<string[]> {
  return platform.getFileList();
}

export function getFilteredFileList(
  config: RenovateConfig,
  fileList: string[]
): string[] {
  const { includePaths, ignorePaths } = config;
  let filteredList = getIncludedFiles(fileList, includePaths);
  filteredList = filterIgnoredFiles(filteredList, ignorePaths);
  return filteredList;
}

export async function getMatchingFiles(
  config: RenovateConfig
): Promise<string[]> {
  const allFiles = await getFileList();
  const fileList = getFilteredFileList(config, allFiles);
  const { fileMatch, manager } = config;
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
