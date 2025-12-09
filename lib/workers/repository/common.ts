import { DEBUG, ERROR, FATAL, INFO, TRACE, WARN, nameFromLevel } from 'bunyan';
import { getProblems } from '../../logger';
import { emojify } from '../../util/emoji';

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
