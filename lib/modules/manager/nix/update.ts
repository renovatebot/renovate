import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
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
  const match = regEx(
    /^(?<prefix>github:[^/?#]+\/[^/?#]+\/)(?<ref>[^?#]+)(?<suffix>[?#].*)?$/,
  ).exec(url);
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

function updateQueryParameter(
  url: string,
  parameter: string,
  updateValue: (value: string) => string,
): string {
  const queryStart = url.indexOf('?');
  const fragmentStart = url.indexOf('#');
  if (
    queryStart === -1 ||
    (fragmentStart !== -1 && queryStart > fragmentStart)
  ) {
    return url;
  }

  const queryEnd = fragmentStart === -1 ? url.length : fragmentStart;
  const query = url.slice(queryStart, queryEnd);
  const match = regEx(`[?&]${RegExp.escape(parameter)}=(?<value>[^&]*)`).exec(
    query,
  );
  if (!match?.groups || match.index === undefined) {
    return url;
  }

  const value = match.groups.value;

  const updatedValue = updateValue(value);
  if (updatedValue === value) {
    return url;
  }

  const valueStart = queryStart + match.index + match[0].lastIndexOf(value);
  return `${url.slice(0, valueStart)}${updatedValue}${url.slice(valueStart + value.length)}`;
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

  newUrl = updateQueryParameter(newUrl, 'ref', (ref) =>
    replaceVersion(ref, currentValue, newValue),
  );
  newUrl = updateQueryParameter(newUrl, 'rev', (rev) =>
    currentDigest &&
    newDigest &&
    currentDigest !== newDigest &&
    rev === currentDigest
      ? newDigest
      : rev,
  );

  return newUrl;
}

function getBraceDepth(content: string, end: number): number {
  const nixSyntax = content
    .slice(0, end)
    .replace(
      regEx(/"(?:\\.|[^"\\])*"|''[\s\S]*?''|#[^\n]*|\/\*[\s\S]*?\*\//g),
      '',
    );
  let depth = 0;
  for (const char of nixSyntax) {
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    }
  }
  return depth;
}

function findInputUrl(
  fileContent: string,
  patterns: RegExp[],
): RegExpMatchArray | null {
  const matches = patterns.flatMap((pattern) => [
    ...fileContent.matchAll(pattern),
  ]);

  matches.sort(
    (left, right) =>
      getBraceDepth(fileContent, left.index) -
      getBraceDepth(fileContent, right.index),
  );

  return matches[0] ?? null;
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
    `^\\s*${inputPrefix}${RegExp.escape(depName)}\\.url\\s*=\\s*"(?<url>[^"]+)"`,
    'gm',
  );
  // Only match simple attribute sets where `url` is the first member. This
  // intentionally avoids trying to parse arbitrary Nix expressions with regex.
  const attrSetPattern = regEx(
    `^\\s*${inputPrefix}${RegExp.escape(depName)}\\s*=\\s*\\{\\s*url\\s*=\\s*"(?<url>[^"]+)"`,
    'gm',
  );
  const match = findInputUrl(fileContent, [directPattern, attrSetPattern]);

  if (!match?.groups || match.index === undefined) {
    logger.debug(`Could not find URL for dependency ${depName}`);
    return fileContent;
  }

  const oldUrl = match.groups.url;
  const newUrl = updateUrl(
    oldUrl,
    currentValue ?? undefined,
    newValue ?? undefined,
    currentDigest,
    newDigest ?? undefined,
  );
  if (newUrl === null) {
    logger.debug(`Could not parse URL for dependency ${depName}: ${oldUrl}`);
    return fileContent;
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
    return fileContent;
  }

  const urlStart = match.index + match[0].lastIndexOf(oldUrl);
  const updatedContent =
    fileContent.slice(0, urlStart) +
    newUrl +
    fileContent.slice(urlStart + oldUrl.length);

  logger.debug({ depName, oldUrl, newUrl }, 'Successfully updated Nix flake');
  return updatedContent;
}
