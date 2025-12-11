import { parse, weave } from 'jsonc-weaver';
import { logger } from '../../../logger/index.ts';
import { writeLocalFile } from '../../../util/fs/index.ts';
import { escapeRegExp, regEx } from '../../../util/regex.ts';
import { replaceAt } from '../../../util/string.ts';
import type { UpdateDependencyConfig } from '../types.ts';
import { isLockFilePath, isYamlFilePath } from './extract.ts';
import type { KasRepo } from './schema.ts';

export async function updateDependency({
  fileContent,
  packageFile,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const {
    depName,
    datasource,
    currentValue,
    newValue,
    currentDigest,
    newDigest,
  } = upgrade;
  logger.debug({ packageFile }, 'kas.updateDependency');
  if (!packageFile) {
    logger.warn({ depName }, 'No package file provided for update.');
    return fileContent;
  }
  if (!fileContent) {
    logger.warn({ packageFile }, 'No file content provided for update.');
    return fileContent;
  }
  if (datasource === 'git-tags' && currentValue === newValue) {
    logger.debug(
      { packageFile, depName, currentValue, newDigest },
      'git tag version did not change. Skipping digest update.',
    );
    return fileContent;
  }
  if (isYamlFilePath(packageFile)) {
    const replaceString = upgrade.replaceString ?? currentDigest;
    const searchIndex: number = fileContent.indexOf(replaceString!);
    if (searchIndex === -1) {
      logger.warn(
        { packageFile, depName, fileContent, replaceString },
        'Cannot find replaceString in current file content.',
      );
      return fileContent;
    }
    try {
      let newString = replaceString!;
      if (currentValue && newValue && currentValue !== newValue) {
        if (!newString.includes(currentValue)) {
          logger.trace(
            { stringToReplace: newString, currentValue },
            'currentValue not found in string to replace',
          );
        }
        newString = newString.replace(
          regEx(escapeRegExp(currentValue)),
          newValue,
        );
      }
      if (currentDigest && newDigest && currentDigest !== newDigest) {
        if (!newString.includes(currentDigest)) {
          logger.trace(
            { stringToReplace: newString, currentDigest },
            'currentDigest not found in string to replace',
          );
        }
        newString = newString.replace(
          regEx(escapeRegExp(currentDigest)),
          newDigest,
        );
      }
      logger.trace(
        { packageFile, depName },
        `Starting search at index ${searchIndex}`,
      );
      let newContent = fileContent;
      newContent = replaceAt(
        newContent,
        searchIndex,
        replaceString!,
        newString,
      );
      if (newContent === fileContent) {
        logger.warn(
          { packageFile, depName },
          'Replacement did not change file content',
        );
        return fileContent;
      }
      await writeLocalFile(packageFile, newContent);
      return newContent;
    } catch (err) {
      logger.warn({ packageFile, depName, err }, 'update Dependency error');
      return fileContent;
    }
  } else {
    let parsedContent = null;
    const isLockFile = isLockFilePath(packageFile);
    if (!depName) {
      logger.warn({ packageFile }, 'Dependency name not provided for update.');
      return fileContent;
    }
    if (isLockFile) {
      parsedContent = parse(fileContent);
      const repos = parsedContent?.overrides?.repos;
      if (!parsedContent || !repos) {
        logger.warn(
          { packageFile, depName },
          'Parsed content or repos not found for non-yaml file.',
        );
        return fileContent;
      }
      const repo = repos[depName];
      if (!repo) {
        logger.warn(
          { packageFile, depName },
          'Repo not found in lock file for given dependency name.',
        );
        return fileContent;
      }
      if (
        newDigest &&
        currentDigest === repo.commit &&
        currentDigest !== newDigest
      ) {
        repo.commit = newDigest;
      }
    } else {
      parsedContent = parse(fileContent);
      const repos: Record<string, KasRepo | null | undefined> =
        parsedContent?.repos;
      if (!parsedContent || !repos) {
        logger.warn(
          { packageFile, depName },
          'Parsed content or repos not found for non-yaml file.',
        );
        return fileContent;
      }
      let repo = repos[depName];
      if (!repo || repo.name !== depName) {
        for (const r of Object.values(repos)) {
          if (r?.name === depName) {
            repo = r;
          }
        }
      }
      if (!repo) {
        logger.warn(
          { packageFile, depName },
          'Repo not found in project file for given dependency name.',
        );
        return fileContent;
      }
      if (
        newDigest &&
        currentDigest === repo.commit &&
        currentDigest !== newDigest
      ) {
        repo.commit = newDigest;
      }
      if (newValue && currentValue === repo.tag && currentValue !== newValue) {
        repo.tag = newValue;
      }
    }
    const newContent = weave(fileContent, parsedContent);
    await writeLocalFile(packageFile, newContent);
    return newContent;
  }
}
