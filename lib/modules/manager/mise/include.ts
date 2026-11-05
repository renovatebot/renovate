import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';
import { extractGitReference } from './git-reference.ts';

const ociPrefix = 'oci::';

function extractOciInclude(include: string): PackageDependency {
  // `replaceString` and the template cover the image reference only,
  // so the `oci::` prefix stays in place.
  const dep = getDep(include.slice(ociPrefix.length));
  return { ...dep, depType: 'include' };
}

/**
 * Extracts a remote `include` entry of a mise configuration file.
 * `content` is the raw file, used to read trailing comment hints.
 * @link https://mise.jdx.dev/configuration.html#include
 */
export function extractInclude(
  include: string,
  content: string,
): PackageDependency {
  const trimmed = include.trim();
  if (trimmed.startsWith(ociPrefix)) {
    return extractOciInclude(trimmed);
  }
  const gitDep = extractGitReference(trimmed, content, 'include');
  if (gitDep) {
    return gitDep;
  }
  return {
    depName: trimmed,
    depType: 'include',
    skipReason: 'unsupported-url',
  };
}
