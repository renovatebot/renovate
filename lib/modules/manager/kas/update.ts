import { isString } from '@sindresorhus/is';
import { parse, weave } from 'jsonc-weaver';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { replaceAt } from '../../../util/string.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import type { UpdateDependencyConfig } from '../types.ts';
import { isLockFilePath, isYamlFilePath } from './include.ts';
import type { KasRepo } from './schema.ts';

// only touch the value of `<field>:`; the repo key and url may contain the same text
function replaceFieldValue(
  block: string,
  field: 'tag' | 'commit',
  from: string,
  to: string,
): string {
  return block.replace(
    regEx(`^(\\s*${field}:\\s*["']?)${RegExp.escape(from)}`, 'm'),
    `$1${to}`,
  );
}

export function updateDependency({
  fileContent,
  packageFile,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const {
    depName,
    datasource,
    currentValue,
    newValue,
    currentDigest,
    newDigest,
  } = upgrade;
  logger.debug({ packageFile }, 'kas.updateDependency');
  if (datasource === GitTagsDatasource.id && currentValue === newValue) {
    logger.debug(
      { packageFile, depName, currentValue, newDigest },
      'git tag version did not change. Skipping digest update.',
    );
    return fileContent;
  }
  if (isYamlFilePath(packageFile)) {
    const replaceString = upgrade.replaceString;
    /* istanbul ignore if */
    if (!isString(replaceString)) {
      logger.warn(
        { packageFile, depName, replaceString },
        'replaceString is not a string. This should not happen, skipping update.',
      );
      return fileContent;
    }
    const searchIndex: number = fileContent.indexOf(replaceString);
    if (searchIndex === -1) {
      logger.warn(
        { packageFile, depName, fileContent, replaceString },
        'Cannot find replaceString in current file content.',
      );
      return fileContent;
    }
    try {
      let newString = replaceString;
      if (currentValue && newValue && currentValue !== newValue) {
        newString = replaceFieldValue(newString, 'tag', currentValue, newValue);
      }
      if (currentDigest && newDigest && currentDigest !== newDigest) {
        newString = replaceFieldValue(
          newString,
          'commit',
          currentDigest,
          newDigest,
        );
      }
      logger.trace(
        { packageFile, depName },
        `Starting search at index ${searchIndex}`,
      );
      let newContent = fileContent;
      newContent = replaceAt(newContent, searchIndex, replaceString, newString);
      if (newContent === fileContent) {
        logger.warn(
          { packageFile, depName },
          'Replacement did not change file content',
        );
        return fileContent;
      }
      return newContent;
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ packageFile, depName, err }, 'update Dependency error');
      return fileContent;
    }
  } else {
    if (!depName) {
      logger.warn({ packageFile }, 'Dependency name not provided for update.');
      return fileContent;
    }
    let parsedContent;
    try {
      parsedContent = parse(fileContent);
    } catch (err) {
      logger.warn({ packageFile, depName, err }, 'Cannot parse json file.');
      return fileContent;
    }
    const isLockFile = isLockFilePath(packageFile);
    const repos: Record<string, KasRepo | null | undefined> | undefined =
      isLockFile ? parsedContent?.overrides?.repos : parsedContent?.repos;
    if (!repos) {
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
        'Repo not found for given dependency name.',
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
    if (
      !isLockFile &&
      newValue &&
      currentValue === repo.tag &&
      currentValue !== newValue
    ) {
      repo.tag = newValue;
    }
    return weave(fileContent, parsedContent);
  }
}
