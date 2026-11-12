import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';
import { extractGitReference } from './git-reference.ts';

const ociPrefix = 'oci::';
const gitPrefix = 'git::';

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
 * Extracts a remote `[task_config] includes` entry, which supports the same
 * remote forms as `include`. Local paths are ignored, as they carry no version.
 * @link https://mise.jdx.dev/tasks/toml-tasks.html#task-config-includes
 */
export function extractTaskConfigInclude(
  include: string,
  content: string,
): PackageDependency | null {
  const trimmed = include.trim();
  if (!trimmed.startsWith(ociPrefix) && !trimmed.startsWith(gitPrefix)) {
    return null;
  }
  return extractInclude(trimmed, content, 'task-include');
}
