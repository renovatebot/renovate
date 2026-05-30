import { DEBUG, ERROR, FATAL, INFO, TRACE, WARN, nameFromLevel } from 'bunyan';
import { getProblems } from '../../logger/index.ts';
import type { PackageDependency } from '../../modules/manager/types.ts';
import { emojify } from '../../util/emoji.ts';

/**
 * Checks whether a replacement target already exists as a sibling dependency
 * in the same package file.
 */
export function replacementAlreadyExists(
  deps: PackageDependency[],
  currentDep: PackageDependency,
  newName: string,
): boolean {
  return deps.some(
    (sibling) =>
      sibling !== currentDep &&
      (sibling.depName === newName || sibling.packageName === newName),
  );
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
