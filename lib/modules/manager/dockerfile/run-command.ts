import { split } from 'shlex';
import { logger } from '../../../logger/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';

/** Shell operators which start a new command */
const commandSeparators = ['&&', '||', ';', '|', '&', '(', ')', '{', '}'];

/**
 * The `RUN` keyword and its flags, e.g. `RUN --mount=type=cache,target=/x `.
 *
 * Stripping these leaves the shell command that the instruction runs.
 */
const runPrefixRegex = regEx(
  /^[ \t]*(?:ONBUILD[ \t]+)?RUN[ \t]+(?:--[a-z]\S*[ \t]+)*/i,
);

function matchesCommand(token: string | undefined, name: string): boolean {
  return token === name || !!token?.endsWith(`/${name}`);
}

/**
 * Returns the arguments of the command, or `null` if none of the given
 * commands were run.
 *
 * The command is found by its name alone, wherever it sits in the tokens -
 * so it's found whether it's prefixed by a shell keyword (`do`/`then`/...),
 * a variable assignment (`DEBUG=1 apk add ...`), or a wrapper program
 * (`sudo`/`chroot /mnt`/`timeout 30`/...).
 */
function matchCommand(tokens: string[], names: string[]): string[] | null {
  const index = tokens.findIndex((token) =>
    names.some((name) => matchesCommand(token, name)),
  );
  if (index === -1) {
    return null;
  }
  return tokens.slice(index + 1);
}

/**
 * Finds the invocations of the given commands in a `RUN` instruction, e.g. the
 * `add --no-cache bash=5.2.37-r2` of
 *
 * ```dockerfile
 * RUN apk update && apk add --no-cache bash=5.2.37-r2
 * ```
 *
 * @param instruction the full `RUN` instruction, including any line continuations
 * @param escapeChar the Dockerfile escape character, already regex-escaped
 * @param names the commands to look for, e.g. `['apt', 'apt-get']`
 * @returns the arguments of each invocation, in the order they were run
 */
export function parseRunCommands(
  instruction: string,
  escapeChar: string,
  names: string[],
): string[][] {
  // A `#` line inside a line continuation is a Dockerfile comment, and is
  // dropped before the shell ever sees it
  const joined = instruction
    .split(newlineRegex)
    .filter((line) => !regEx(/^[ \t]*#/).test(line))
    .join('\n')
    .replace(regEx(`${escapeChar}[ \\t]*\\r?\\n`, 'g'), ' ');

  const runPrefix = runPrefixRegex.exec(joined)?.[0];
  if (!runPrefix) {
    return [];
  }

  const command = joined.slice(runPrefix.length);
  if (!names.some((name) => command.includes(name))) {
    return [];
  }

  let tokens: string[];
  try {
    tokens = split(command);
  } catch (err) {
    logger.debug({ err, command }, 'Failed to tokenize Dockerfile RUN command');
    return [];
  }

  // Split the shell command into the individual commands it runs, so that only
  // the arguments of a matching invocation are considered
  const commands: string[][] = [];
  let current: string[] = [];
  for (const token of tokens) {
    if (token.startsWith('#')) {
      // the rest of the command is a shell comment
      break;
    }
    if (commandSeparators.includes(token)) {
      commands.push(current);
      current = [];
      continue;
    }
    // e.g. the `{1..10};` of `for iter in {1..10}; do apk add ...`, which shlex
    // keeps as one token because no whitespace precedes the `;`
    if (token.endsWith(';')) {
      current.push(token.slice(0, -1));
      commands.push(current);
      current = [];
      continue;
    }
    current.push(token);
  }
  commands.push(current);

  return commands
    .map((command) => matchCommand(command, names))
    .filter((args) => args !== null);
}
