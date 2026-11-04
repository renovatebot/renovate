import { DEBUG, ERROR, FATAL, INFO, TRACE, WARN, nameFromLevel } from 'bunyan';
import { pkg } from '../../expose.ts';
import { getProblems } from '../../logger/index.ts';
import type { PackageDependency } from '../../modules/manager/types.ts';
import { prDebugDataRe } from '../../modules/platform/pr-body.ts';
import { emojify } from '../../util/emoji.ts';
import { toBase64 } from '../../util/string.ts';

/**
 * Checks whether a replacement target already exists as a sibling dependency
 * in the same package file.
 */
export function replacementAlreadyExists(
  deps: PackageDependency[],
  currentDep: PackageDependency,
  newName: string,
): boolean {
  return deps.some((sibling) => {
    if (sibling === currentDep) {
      return false;
    }
    return sibling.depName === newName || sibling.packageName === newName;
  });
}

export function extractRepoProblems(
  repository: string | undefined,
): Set<string> {
  return new Set(
    getProblems()
      .filter(
        (problem) =>
          problem.repository === repository && !problem.artifactErrors,
      )
      .map((problem) => `${formatProblemLevel(problem.level)}: ${problem.msg}`),
  );
}

type EmojiLogLevelMapping = Record<number, string>;

const logLevelEmojis: EmojiLogLevelMapping = {
  [TRACE]: ':microscope:',
  [DEBUG]: ':mag:',
  [INFO]: ':information_source:',
  [WARN]: ':warning:',
  [ERROR]: ':x:',
  [FATAL]: ':skull:',
};

export function formatProblemLevel(level: number): string {
  const name = nameFromLevel[level].toUpperCase();
  const emojiName = logLevelEmojis[level];

  return `${emojify(emojiName)} ${name}`;
}

/**
 * Add debug data to an issue's body, in the same format as a PR's, recording which Renovate version last changed it.
 */
export function withIssueDebugData(
  body: string,
  existingBody?: string | null,
): string {
  // an issue which is otherwise unchanged keeps its existing body, so it isn't updated by every Renovate release
  if (existingBody?.replace(prDebugDataRe, '') === body) {
    return existingBody;
  }
  const debugData = toBase64(JSON.stringify({ updatedInVer: pkg.version }));
  return `${body}\n<!--renovate-debug:${debugData}-->\n`;
}
