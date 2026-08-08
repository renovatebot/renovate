import { logger } from '../../../logger/index.ts';
import { escapeRegExp, regEx } from '../../../util/regex.ts';
import { parseUrl } from '../../../util/url.ts';
import type { UpdateDependencyConfig } from '../types.ts';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const {
    depName,
    currentValue,
    newValue,
    currentDigest,
    newDigest,
    gitRefType,
  } = upgrade;
  logger.trace({ depName, currentValue, newValue }, 'nix.updateDependency()');

  if (!depName) {
    logger.debug('No depName provided');
    return null;
  }

  // Find the input line for this dependency.
  // Support both direct assignment (`depName.url = "..."`) and attribute set syntax (`depName = { url = "..."; }`)
  const directPattern = regEx(
    `^\\s*${escapeRegExp(depName)}\\.url\\s*=\\s*"([^"]+)"`,
    'gm',
  );
  const attrSetPattern = regEx(
    `^\\s*${escapeRegExp(depName)}\\s*=\\s*\\{[^}]*url\\s*=\\s*"([^"]+)"`,
    'gms',
  );
  const match =
    directPattern.exec(fileContent) ?? attrSetPattern.exec(fileContent);

  if (!match) {
    logger.debug(`Could not find URL for dependency ${depName}`);
    return null;
  }

  const matchedString = match[0];
  const oldUrl = match[1];
  const parsedUrl = parseUrl(oldUrl);
  let newUrl = oldUrl;

  if (!parsedUrl) {
    logger.debug(`Could not parse URL for dependency ${depName}: ${oldUrl}`);
    return null;
  }

  logger.trace({ depName, parsedUrl }, 'Parsed URL for update');

  // `github:` (and other Nix flake shorthand schemes) don't round-trip
  // through the URL class cleanly, so handle them with direct string
  // substitution instead of via parsedUrl.searchParams.
  if (parsedUrl.protocol === 'github:') {
    if (
      currentValue &&
      newValue &&
      currentValue !== newValue &&
      oldUrl.includes(currentValue)
    ) {
      newUrl = newUrl.replace(currentValue, newValue);
    }

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

    if (currentValue && newValue && currentValue !== newValue) {
      const refParam = parsedUrl.searchParams.get('ref');

      if (refParam) {
        const refMatch = regEx(/^refs\/(tags|heads)\/(.+)$/).exec(refParam);
        const oldQualifier = refMatch?.[1];
        const oldRefValue = refMatch ? refMatch[2] : refParam;

        if (refMatch || oldRefValue.includes(currentValue)) {
          const newRefValue = oldRefValue.replace(currentValue, newValue);

          /**
           * Decide how to qualify the ref.
           *
           * `gitRefType` comes from the git-refs datasource and states whether
           * newValue actually resolves to a tag or a branch upstream. Nix's git
           * fetcher resolves a bare (unqualified) ref as `refs/heads/<ref>`
           * only, with no fallback to tags, so writing back a bare tag name
           * (or a ref pinned with a stale `refs/tags/`/`refs/heads/` qualifier
           * that no longer matches the new value's actual ref type) causes
           * `nix flake lock`/`nix flake update` to fail with "couldn't find
           * remote ref". Prefer the upstream-confirmed ref type; only fall
           * back to inheriting the old ref's qualifier (or leaving the ref
           * bare, matching the old ref's own shape) when that information
           * isn't available.
           */
          const qualifier = gitRefType ?? oldQualifier;
          const updatedRef = qualifier
            ? `refs/${qualifier}/${newRefValue}`
            : newRefValue;

          if (updatedRef !== refParam) {
            if (!qualifier) {
              logger.debug(
                { depName, updatedRef },
                'nix: no gitRefType available; leaving flake ref unqualified',
              );
            }
            parsedUrl.searchParams.set('ref', updatedRef);
            urlModified = true;
          }
        }
      }
    }

    if (currentDigest && newDigest && currentDigest !== newDigest) {
      const revParam = parsedUrl.searchParams.get('rev');

      if (revParam && revParam === currentDigest) {
        parsedUrl.searchParams.set('rev', newDigest);
        urlModified = true;
      }
    }

    if (urlModified) {
      newUrl = parsedUrl.toString();

      // URL constructor encodes forward slashes in query params, but Nix
      // flake ref URLs expect them unencoded (e.g. `ref=refs/tags/v1.0.0`).
      const queryStart = newUrl.indexOf('?');
      if (queryStart !== -1) {
        newUrl =
          newUrl.substring(0, queryStart) +
          newUrl.substring(queryStart).replace(regEx(/%2F/g), '/');
      }
    }
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
        'Digest-only update detected, returning unchanged content for lock file update',
      );

      // The URL text is unchanged; flake.lock's rev gets refreshed via
      // updateArtifacts (`nix flake lock --update-input`) instead.
      return fileContent;
    }

    logger.trace({ depName, url: oldUrl }, 'No changes made to URL');
    return null;
  }

  const replacedMatch = matchedString.replace(oldUrl, newUrl);
  const updatedContent =
    fileContent.substring(0, match.index) +
    replacedMatch +
    fileContent.substring(match.index + matchedString.length);

  /* v8 ignore next 4 -- should never happen */
  if (updatedContent === fileContent) {
    logger.debug({ depName }, 'Failed to update file content');
    return null;
  }

  logger.debug({ depName, oldUrl, newUrl }, 'Successfully updated Nix flake');
  return updatedContent;
}
