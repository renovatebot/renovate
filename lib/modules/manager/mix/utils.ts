import { newlineRegex, regEx } from '../../../util/regex.ts';

const commentMatchRegExp = regEx(/#.*$/);
const repoOptionRegExp = regEx(/repo:\s*"(?<value>[^"]+)"/g);

/**
 * `#` starts a line comment in Elixir. Both extraction and artifact updates
 * must ignore commented-out code, or they disagree on what `mix.exs` declares.
 */
export function stripComments(content: string): string {
  return content
    .split(newlineRegex)
    .map((line) => line.replace(commentMatchRegExp, ''))
    .join('\n');
}

/**
 * Repo names declared through the `repo:` dep option, in order of appearance.
 */
export function getRepoOptions(content: string): string[] {
  return Array.from(
    stripComments(content).matchAll(repoOptionRegExp),
    ({ groups }) => groups!.value,
  );
}
