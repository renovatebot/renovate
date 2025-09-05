import { logger } from '../../../logger';
import { escapeRegExp, regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import type { UpdateDependencyConfig } from '../types';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depName, currentValue, newValue, currentDigest, newDigest } = upgrade;
  logger.trace({ depName, currentValue, newValue }, 'nix.updateDependency()');

  if (!depName) {
    logger.debug('No depName provided');
    return null;
  }

  let updatedContent = fileContent;

  // Find the input line for this dependency
  // Support both direct assignment (`depName.url = "..."`) and attribute set syntax (`depName = { url = "..."; }`)
  const directPattern = regEx(
    `^\\s*${escapeRegExp(depName)}\\.url\\s*=\\s*"([^"]+)"`,
    'gm',
  );
  const attrSetPattern = regEx(
    `^\\s*${escapeRegExp(depName)}\\s*=\\s*\\{[^}]*url\\s*=\\s*"([^"]+)"`,
    'gms',
  );

  let match = directPattern.exec(fileContent);
  let isAttrSet = false;

  if (!match) {
    match = attrSetPattern.exec(fileContent);
    isAttrSet = true;
  }

  if (!match) {
    logger.debug(`Could not find URL for dependency ${depName}`);
    return null;
  }

  const oldUrl = match[1];
  let newUrl = oldUrl;

  const parsedUrl = parseUrl(oldUrl);
  if (!parsedUrl) {
    logger.debug(`Could not parse URL for dependency ${depName}: ${oldUrl}`);
    return null;
  }

  logger.trace({ depName, parsedUrl }, 'Parsed URL for update');

  // Special handling for `github:` protocol URLs where the URL object doesn't properly serialize changes to non-standard protocols
  if (parsedUrl.protocol === 'github:') {
    // Handle version updates
    if (
      currentValue &&
      newValue &&
      currentValue !== newValue &&
      oldUrl.includes(currentValue)
    ) {
      newUrl = newUrl.replace(currentValue, newValue);
    }

    // Handle digest updates
    if (
      currentDigest &&
      newDigest &&
      currentDigest !== newDigest &&
      newUrl.includes(currentDigest)
    ) {
      newUrl = newUrl.replace(currentDigest, newDigest);
    }
  } else {
    let urlModified = false;

    // Handle ref updates (version updates)
    if (currentValue && newValue && currentValue !== newValue) {
      const refParam = parsedUrl.searchParams.get('ref');

      if (refParam) {
        // Update refs/tags/X.Y.Z or refs/heads/branch patterns
        const refMatch = /^refs\/(tags|heads)\/(.+)$/.exec(refParam);
        if (refMatch) {
          const newRef = `refs/${refMatch[1]}/${newValue}`;
          parsedUrl.searchParams.set('ref', newRef);
          urlModified = true;
        }
      } else if (currentValue && parsedUrl.pathname.includes(currentValue)) {
        // Fallback: direct replacement if the version is in the URL path
        parsedUrl.pathname = parsedUrl.pathname.replace(currentValue, newValue);
        urlModified = true;
      }
    }

    // Handle rev updates (digest updates)
    if (currentDigest && newDigest && currentDigest !== newDigest) {
      const revParam = parsedUrl.searchParams.get('rev');

      if (revParam && revParam === currentDigest) {
        parsedUrl.searchParams.set('rev', newDigest);
        urlModified = true;
      } else if (currentDigest && parsedUrl.pathname.includes(currentDigest)) {
        // Fallback: direct replacement if the digest is in the URL path
        parsedUrl.pathname = parsedUrl.pathname.replace(
          currentDigest,
          newDigest,
        );
        urlModified = true;
      }
    }

    // Convert back to string, preserving the unencoded forward slashes in query params
    if (urlModified) {
      newUrl = parsedUrl.toString();

      // URL constructor encodes forward slashes in query params but Nix URLs expect them unencoded
      const queryStart = newUrl.indexOf('?');
      if (queryStart !== -1) {
        newUrl =
          newUrl.substring(0, queryStart) +
          newUrl.substring(queryStart).replace(/%2F/g, '/');
      }
    }
  }

  if (newUrl === oldUrl) {
    logger.trace({ depName, url: oldUrl }, 'No changes made to URL');
    return null;
  }

  // Replace the old URL with the new URL in the file content
  if (isAttrSet) {
    // For attribute set syntax (`depName = { url = "..."; }`)
    const fullLinePattern = regEx(
      `(^\\s*${escapeRegExp(depName)}\\s*=\\s*\\{[^}]*url\\s*=\\s*")${escapeRegExp(oldUrl)}(")`,
      'gms',
    );
    updatedContent = updatedContent.replace(fullLinePattern, `$1${newUrl}$2`);
  } else {
    // For direct assignment (`depName.url = "..."`)
    const fullLinePattern = regEx(
      `(^\\s*${escapeRegExp(depName)}\\.url\\s*=\\s*")${escapeRegExp(oldUrl)}(".*$)`,
      'gm',
    );
    updatedContent = updatedContent.replace(fullLinePattern, `$1${newUrl}$2`);
  }

  if (updatedContent === fileContent) {
    logger.debug({ depName }, 'Failed to update file content');
    return null;
  }

  logger.debug({ depName, oldUrl, newUrl }, 'Successfully updated Nix flake');
  return updatedContent;
}
