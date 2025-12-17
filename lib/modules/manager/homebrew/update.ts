import { logger } from '../../../logger';
import { hashStream } from '../../../util/hash';
import { Http } from '../../../util/http';
import type { UpdateDependencyConfig } from '../types';
import { findHandlerByType } from './handlers';
import type { HomebrewManagerData } from './types';
import { updateRubyString } from './utils';

const http = new Http('homebrew');

export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig<HomebrewManagerData>): Promise<string> {
  const { packageFile, depName } = upgrade;

  logger.trace('updateDependency()');

  const { managerData, newValue } = upgrade;
  if (!managerData?.url || !managerData.sha256 || !newValue) {
    logger.debug({ packageFile, depName }, `Missing data`);
    return fileContent;
  }

  // Find handler by type
  const handler = findHandlerByType(managerData.type);
  if (!handler) {
    logger.debug(
      { packageFile, depName },
      `Unknown handler type ${managerData.type}`,
    );
    return fileContent;
  }

  // Validate old URL can be parsed
  const oldParsed = handler.parseUrl(managerData.url);
  if (!oldParsed) {
    logger.debug(
      { packageFile, depName },
      `Failed to parse old URL '${managerData.url}'`,
    );
    return fileContent;
  }

  // Build candidate URLs to try
  const candidateUrls: string[] = [];

  const buildArchiveUrls = handler.buildArchiveUrls(managerData, newValue);
  if (!buildArchiveUrls) {
    logger.debug({ packageFile, depName }, `Failed to build new URL`);
    return fileContent;
  }
  candidateUrls.push(...buildArchiveUrls);

  // Try each candidate URL
  let newUrl: string | null = null;
  let newSha256: string | null = null;

  for (const candidateUrl of candidateUrls) {
    // Validate URL parses correctly
    const newParsed = handler.parseUrl(candidateUrl);
    if (!newParsed || newParsed?.currentValue !== newValue) {
      logger.debug(
        { packageFile, depName },
        `URL validation failed for '${candidateUrl}'`,
      );
      continue;
    }

    // Try to download and compute SHA256
    try {
      newSha256 = await hashStream(http.stream(candidateUrl), 'sha256');
      newUrl = candidateUrl;
      logger.trace(
        { packageFile, depName },
        `Successfully downloaded '${candidateUrl}'`,
      );
      break;
    } catch {
      logger.debug(
        { packageFile, depName },
        `Failed to download ${candidateUrl}`,
      );
    }
  }

  if (!newUrl || !newSha256) {
    logger.debug({ packageFile, depName }, `All download attempts failed`);
    return fileContent;
  }

  // Update URL and SHA256 in file
  let newContent = updateRubyString(
    fileContent,
    'url',
    managerData.url,
    newUrl,
  );
  if (!newContent) {
    logger.debug({ packageFile, depName }, `Failed to update URL`);
    return fileContent;
  }

  newContent = updateRubyString(
    newContent,
    'sha256',
    managerData.sha256,
    newSha256,
  );
  if (!newContent) {
    logger.debug({ packageFile, depName }, `Failed to update SHA256`);
    return fileContent;
  }

  return newContent;
}
