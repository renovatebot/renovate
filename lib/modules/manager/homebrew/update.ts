import semver from 'semver';
import { logger } from '../../../logger';
import { hashStream } from '../../../util/hash';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import type { UpdateDependencyConfig } from '../types';
import { parseUrlPath } from './extract';

const http = new Http('homebrew');

function escapeRegex(str: string): string {
  return str.replace(regEx(/[$()*+.?[\\\]^{|}]/g), '\\$&');
}

export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string> {
  logger.trace('updateDependency()');

  // Validate upgrade data
  const oldParsedUrlPath = parseUrlPath(upgrade.managerData?.url);
  if (!oldParsedUrlPath || !upgrade.managerData) {
    logger.debug(
      `Failed to update - upgrade.managerData.url is invalid ${upgrade.depName}`,
    );
    return fileContent;
  }

  // Try to download new tarball and compute SHA256
  const ownerName = String(upgrade.managerData.ownerName);
  const repoName = String(upgrade.managerData.repoName);
  let newUrl: string;
  let newSha256: string;

  try {
    // Try releases/download format first
    newUrl = `https://github.com/${ownerName}/${repoName}/releases/download/${
      upgrade.newValue
    }/${repoName}-${String(semver.coerce(upgrade.newValue))}.tar.gz`;
    newSha256 = await hashStream(http.stream(newUrl), 'sha256');
  } catch {
    logger.debug(
      `Failed to download release download for ${upgrade.depName} - trying archive instead`,
    );
    try {
      // Fallback to archive/refs/tags format
      newUrl = `https://github.com/${ownerName}/${repoName}/archive/refs/tags/${upgrade.newValue}.tar.gz`;
      newSha256 = await hashStream(http.stream(newUrl), 'sha256');
    } catch {
      logger.debug(
        `Failed to download archive download for ${upgrade.depName} - update failed`,
      );
      return fileContent;
    }
  }

  // Validate the new URL can be parsed correctly
  const newParsedUrlPath = parseUrlPath(newUrl);
  if (!newParsedUrlPath) {
    logger.debug(`Failed to update url for dependency ${upgrade.depName}`);
    return fileContent;
  }
  if (upgrade.newValue !== newParsedUrlPath.currentValue) {
    logger.debug(`Failed to update url for dependency ${upgrade.depName}`);
    return fileContent;
  }

  // Update URL in file content
  const oldUrl = upgrade.managerData.url;
  const urlRegex = new RegExp(
    `(?<prefix>\\burl\\s+)(?<quote>['"])${escapeRegex(oldUrl)}\\k<quote>`,
    'g',
  );
  let newContent = fileContent.replace(
    urlRegex,
    `$<prefix>$<quote>${newUrl}$<quote>`,
  );
  if (newContent === fileContent) {
    logger.debug(`Failed to update url for dependency ${upgrade.depName}`);
    return fileContent;
  }

  // Update SHA256 in file content
  const oldSha256 = upgrade.managerData.sha256;
  const sha256Regex = new RegExp(
    `(?<prefix>\\bsha256\\s+)(?<quote>['"])${escapeRegex(oldSha256)}\\k<quote>`,
    'g',
  );
  newContent = newContent.replace(
    sha256Regex,
    `$<prefix>$<quote>${newSha256}$<quote>`,
  );
  if (!newContent.includes(newSha256)) {
    logger.debug(`Failed to update sha256 for dependency ${upgrade.depName}`);
    return fileContent;
  }

  return newContent;
}
