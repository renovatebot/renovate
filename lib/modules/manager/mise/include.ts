import { regEx } from '../../../util/regex.ts';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';
import { extractGitReference } from './git-reference.ts';

const ociPrefix = 'oci::';

// Every remote include form uses the mise `<backend>::` prefix, e.g.
// `git::`, `oci::` or `zip::`; local paths never do.
const remotePrefixRegex = regEx(/^[a-z][a-z0-9_-]*::/);

/**
 * Extracts a remote include entry of a mise configuration file: either a
 * top-level `include` entry or a `[task_config] includes` entry.
 * `content` is the raw file, used to read trailing comment hints.
 * @link https://mise.jdx.dev/configuration.html#include
 */
export function extractInclude(
  include: string,
  content: string,
  depType = 'include',
): PackageDependency {
  const trimmed = include.trim();
  if (trimmed.startsWith(ociPrefix)) {
    const dep = getDep(trimmed.slice(ociPrefix.length));
    return { ...dep, depType };
  }
  const gitDep = extractGitReference(trimmed, content, depType);
  if (gitDep) {
    return gitDep;
  }
  return {
    depName: trimmed,
    depType,
    skipReason: 'unsupported-url',
  };
}

/**
 * Extracts a remote `[task_config] includes` entry. Remote forms carry the
 * mise `<backend>::` prefix (`git::`, `oci::`, `zip::`, …); entries without
 * one are local paths, which carry no version and are ignored.
 * @link https://mise.jdx.dev/tasks/task-discovery.html#include-task-files-and-directories
 */
export function extractTaskConfigInclude(
  include: string,
  content: string,
): PackageDependency | null {
  const trimmed = include.trim();
  if (!remotePrefixRegex.test(trimmed)) {
    return null;
  }
  return extractInclude(trimmed, content, 'task-include');
}
