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
  logger.trace('updateDependency()');

  const { managerData, newValue } = upgrade;
  if (!managerData?.url || !managerData.sha256 || !newValue) {
    logger.debug(`Missing data for ${upgrade.depName}`);
    return fileContent;
  }

  // Find handler by type
  const handler = findHandlerByType(managerData.type);
  if (!handler) {
    logger.debug(`Unknown handler type ${managerData.type}`);
    return fileContent;
  }

  // Validate old URL can be parsed
  const oldParsed = handler.parseUrl(managerData.url);
  if (!oldParsed) {
    logger.debug(`Failed to parse old URL for ${upgrade.depName}`);
    return fileContent;
  }

  // Build candidate URLs to try
  const candidateUrls: string[] = [];

  // For other handler types, use the default buildNewUrl
  const newUrls = handler.buildNewUrls(managerData, newValue);
  if (!newUrls) {
    logger.debug(`Failed to build new URL for ${upgrade.depName}`);
    return fileContent;
  }
  candidateUrls.push(...newUrls);

  // Try each candidate URL
  let newUrl: string | null = null;
  let newSha256: string | null = null;

  for (const candidateUrl of candidateUrls) {
    // Validate URL parses correctly
    const newParsed = handler.parseUrl(candidateUrl);
    if (!newParsed || newParsed?.currentValue !== newValue) {
      logger.debug(
        `URL validation failed for ${candidateUrl} (${upgrade.depName})`,
      );
      continue;
    }

    // Try to download and compute SHA256
    try {
      newSha256 = await hashStream(http.stream(candidateUrl), 'sha256');
      newUrl = candidateUrl;
      logger.debug(`Successfully downloaded ${candidateUrl}`);
      break;
    } catch {
      logger.debug(`Failed to download ${candidateUrl}`);
    }
  }

  if (!newUrl || !newSha256) {
    logger.debug(`All download attempts failed for ${upgrade.depName}`);
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
    logger.debug(`Failed to update URL for ${upgrade.depName}`);
    return fileContent;
  }

  newContent = updateRubyString(
    newContent,
    'sha256',
    managerData.sha256,
    newSha256,
  );
  if (!newContent) {
    logger.debug(`Failed to update SHA256 for ${upgrade.depName}`);
    return fileContent;
  }

  return newContent;
}
