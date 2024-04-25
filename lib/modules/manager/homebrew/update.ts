// TODO: types (#22198)
import semver from 'semver';
import { logger } from '../../../logger';
import { hashStream } from '../../../util/hash';
import { Http } from '../../../util/http';
import type { UpdateDependencyConfig } from '../types';
import { parseUrlPath } from './extract';
import { isSpace, removeComments, skip } from './util';

const http = new Http('homebrew');

function replaceUrl(
  idx: number,
  content: string,
  oldUrl: string,
  newUrl: string,
): string | null {
  let i = idx;
  i += 'url'.length;
  i = skip(i, content, (c) => isSpace(c));
  const chr = content[i];
  if (chr !== '"' && chr !== "'") {
    return null;
  }
  i += 1;
  const newContent =
    content.substring(0, i) + content.substring(i).replace(oldUrl, newUrl);
  return newContent;
}

function getUrlTestContent(
  content: string,
  oldUrl: string,
  newUrl: string,
): string | null {
  const urlRegExp = /(^|\s)url(\s)/;
  const cleanContent = removeComments(content);
  let j = cleanContent.search(urlRegExp);
  if (isSpace(cleanContent[j])) {
    j += 1;
  }
  const testContent = replaceUrl(j, cleanContent, oldUrl, newUrl);
  return testContent;
}

function updateUrl(
  content: string,
  oldUrl: string,
  newUrl: string,
): string | null {
  const urlRegExp = /(^|\s)url(\s)/;
  let i = content.search(urlRegExp);
  if (i === -1) {
    return null;
  }
  if (isSpace(content[i])) {
    i += 1;
  }
  let newContent = replaceUrl(i, content, oldUrl, newUrl);
  const testContent = getUrlTestContent(content, oldUrl, newUrl);
  if (!newContent || !testContent) {
    return null;
  }
  while (newContent && removeComments(newContent) !== testContent) {
    i += 'url'.length;
    i += content.substring(i).search(urlRegExp);
    if (isSpace(content[i])) {
      i += 1;
    }
    newContent = replaceUrl(i, content, oldUrl, newUrl);
  }
  return newContent;
}

function replaceSha256(
  idx: number,
  content: string,
  oldSha256: string,
  newSha256: string,
): string | null {
  let i = idx;
  i += 'sha256'.length;
  i = skip(i, content, (c) => isSpace(c));
  const chr = content[i];
  if (chr !== '"' && chr !== "'") {
    return null;
  }
  i += 1;
  const newContent =
    content.substring(0, i) +
    content.substring(i).replace(oldSha256, newSha256);
  return newContent;
}

function getSha256TestContent(
  content: string,
  oldSha256: string,
  newSha256: string,
): string | null {
  const sha256RegExp = /(^|\s)sha256(\s)/;
  const cleanContent = removeComments(content);
  let j = cleanContent.search(sha256RegExp);
  if (isSpace(cleanContent[j])) {
    j += 1;
  }
  const testContent = replaceSha256(j, cleanContent, oldSha256, newSha256);
  return testContent;
}

function updateSha256(
  content: string,
  oldSha256: string,
  newSha256: string,
): string | null {
  const sha256RegExp = /(^|\s)sha256(\s)/;
  let i = content.search(sha256RegExp);
  if (i === -1) {
    return null;
  }
  if (isSpace(content[i])) {
    i += 1;
  }
  let newContent = replaceSha256(i, content, oldSha256, newSha256);
  const testContent = getSha256TestContent(content, oldSha256, newSha256);
  if (!newContent || !testContent) {
    return null;
  }
  while (newContent && removeComments(newContent) !== testContent) {
    i += 'sha256'.length;
    i += content.substring(i).search(sha256RegExp);
    if (isSpace(content[i])) {
      i += 1;
    }
    newContent = replaceSha256(i, content, oldSha256, newSha256);
  }
  return newContent;
}

// TODO: Refactor (#9591)
export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string> {
  logger.trace('updateDependency()');
  /*
    1. Update url field 2. Update sha256 field
   */
  let newUrl: string;
  // Example urls:
  // "https://github.com/bazelbuild/bazel-watcher/archive/v0.8.2.tar.gz"
  // "https://github.com/aide/aide/releases/download/v0.16.1/aide-0.16.1.tar.gz"
  const oldParsedUrlPath = parseUrlPath(upgrade.managerData?.url);
  if (!oldParsedUrlPath || !upgrade.managerData) {
    logger.debug(
      `Failed to update - upgrade.managerData.url is invalid ${upgrade.depName}`,
    );
    return fileContent;
  }
  let newSha256: string;
  try {
    const ownerName = String(upgrade.managerData.ownerName);
    const repoName = String(upgrade.managerData.repoName);
    newUrl = `https://github.com/${ownerName}/${repoName}/releases/download/${
      upgrade.newValue
    }/${repoName}-${String(semver.coerce(upgrade.newValue))}.tar.gz`;
    newSha256 = await hashStream(http.stream(newUrl), 'sha256');
  } catch (errOuter) {
    logger.debug(
      `Failed to download release download for ${upgrade.depName} - trying archive instead`,
    );
    try {
      const ownerName = String(upgrade.managerData.ownerName);
      const repoName = String(upgrade.managerData.repoName);
      newUrl = `https://github.com/${ownerName}/${repoName}/archive/${upgrade.newValue}.tar.gz`;
      newSha256 = await hashStream(http.stream(newUrl), 'sha256');
    } catch (errInner) {
      logger.debug(
        `Failed to download archive download for ${upgrade.depName} - update failed`,
      );
      return fileContent;
    }
  }
  // istanbul ignore next
  if (!newSha256) {
    logger.debug(
      `Failed to generate new sha256 for ${upgrade.depName} - update failed`,
    );
    return fileContent;
  }
  const newParsedUrlPath = parseUrlPath(newUrl);
  if (!newParsedUrlPath) {
    logger.debug(`Failed to update url for dependency ${upgrade.depName}`);
    return fileContent;
  }
  if (upgrade.newValue !== newParsedUrlPath.currentValue) {
    logger.debug(`Failed to update url for dependency ${upgrade.depName}`);
    return fileContent;
  }
  let newContent = updateUrl(fileContent, upgrade.managerData.url, newUrl);
  if (!newContent) {
    logger.debug(`Failed to update url for dependency ${upgrade.depName}`);
    return fileContent;
  }
  newContent = updateSha256(newContent, upgrade.managerData.sha256, newSha256);
  if (!newContent) {
    logger.debug(`Failed to update sha256 for dependency ${upgrade.depName}`);
    return fileContent;
  }
  return newContent;
}
