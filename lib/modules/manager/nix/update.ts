import { logger } from '../../../logger/index.ts';
import { escapeRegExp, regEx } from '../../../util/regex.ts';
import { parseUrl } from '../../../util/url.ts';
import type {
  UpdateDependencyConfig,
  UpdateDependencyResult,
} from '../types.ts';

type NixUpdateDependencyConfig = Pick<
  UpdateDependencyConfig,
  'fileContent' | 'upgrade'
>;

function replaceVersion(
  value: string,
  currentValue?: string,
  newValue?: string,
): string {
  if (
    !currentValue ||
    !newValue ||
    currentValue === newValue ||
    !value.includes(currentValue)
  ) {
    return value;
  }

  return value.replace(currentValue, newValue);
}

function updateGithubPath(
  url: string,
  currentValue?: string,
  newValue?: string,
  currentDigest?: string,
  newDigest?: string,
): string {
  const match =
    /^(?<prefix>github:[^/?#]+\/[^/?#]+\/)(?<ref>[^?#]+)(?<suffix>[?#].*)?$/.exec(
      url,
    );
  if (!match?.groups) {
    return url;
  }

  let ref = replaceVersion(match.groups.ref, currentValue, newValue);
  if (
    currentDigest &&
    newDigest &&
    currentDigest !== newDigest &&
    ref === currentDigest
  ) {
    ref = newDigest;
  }

  return `${match.groups.prefix}${ref}${match.groups.suffix ?? ''}`;
}

function updateUrl(
  oldUrl: string,
  currentValue?: string,
  newValue?: string,
  currentDigest?: string,
  newDigest?: string,
): string | null {
  const parsedUrl = parseUrl(oldUrl);
  if (!parsedUrl) {
    return null;
  }

  let newUrl = oldUrl;
  if (parsedUrl.protocol === 'github:') {
    newUrl = updateGithubPath(
      newUrl,
      currentValue,
      newValue,
      currentDigest,
      newDigest,
    );
  }

  const updatedUrl = parseUrl(newUrl)!;
  let queryModified = false;
  const ref = updatedUrl.searchParams.get('ref');
  if (ref) {
    const updatedRef = replaceVersion(ref, currentValue, newValue);
    if (updatedRef !== ref) {
      updatedUrl.searchParams.set('ref', updatedRef);
      queryModified = true;
    }
  }

  const rev = updatedUrl.searchParams.get('rev');
  if (
    rev &&
    currentDigest &&
    newDigest &&
    currentDigest !== newDigest &&
    rev === currentDigest
  ) {
    updatedUrl.searchParams.set('rev', newDigest);
    queryModified = true;
  }

  if (queryModified) {
    newUrl = updatedUrl.toString();
    const queryStart = newUrl.indexOf('?');
    if (queryStart !== -1) {
      newUrl =
        newUrl.slice(0, queryStart) +
        newUrl.slice(queryStart).replace(/%2F/g, '/');
    }
  }

  return newUrl;
}

export function updateDependency({
  fileContent,
  upgrade,
}: NixUpdateDependencyConfig): string | UpdateDependencyResult | null {
  const { depName, currentValue, newValue, currentDigest, newDigest } = upgrade;
  logger.trace({ depName, currentValue, newValue }, 'nix.updateDependency()');

  if (!depName) {
    logger.debug('No depName provided');
    return null;
  }

  const inputPrefix = '(?:inputs\\.)?';
  const directPattern = regEx(
    `^\\s*${inputPrefix}${escapeRegExp(depName)}\\.url\\s*=\\s*"([^"]+)"`,
    'gm',
  );
  // Only match simple attribute sets where `url` is the first member. This
  // intentionally avoids trying to parse arbitrary Nix expressions with regex.
  const attrSetPattern = regEx(
    `^\\s*${inputPrefix}${escapeRegExp(depName)}\\s*=\\s*\\{\\s*url\\s*=\\s*"([^"]+)"`,
    'gm',
  );
  const match =
    directPattern.exec(fileContent) ?? attrSetPattern.exec(fileContent);

  if (!match) {
    logger.debug(`Could not find URL for dependency ${depName}`);
    return null;
  }

  const oldUrl = match[1];
  const newUrl = updateUrl(
    oldUrl,
    currentValue ?? undefined,
    newValue ?? undefined,
    currentDigest,
    newDigest ?? undefined,
  );
  if (newUrl === null) {
    logger.debug(`Could not parse URL for dependency ${depName}: ${oldUrl}`);
    return null;
  }

  if (newUrl === oldUrl) {
    if (
      currentValue === newValue &&
      currentDigest &&
      newDigest &&
      currentDigest !== newDigest
    ) {
      logger.debug(
        { depName, currentDigest, newDigest, currentValue },
        'Digest-only update detected, requesting lock file update',
      );
      return { content: fileContent, updateArtifacts: true };
    }

    logger.trace({ depName, url: oldUrl }, 'No changes made to URL');
    return null;
  }

  const urlStart = match.index + match[0].lastIndexOf(oldUrl);
  const updatedContent =
    fileContent.slice(0, urlStart) +
    newUrl +
    fileContent.slice(urlStart + oldUrl.length);

  logger.debug({ depName, oldUrl, newUrl }, 'Successfully updated Nix flake');
  return updatedContent;
}
