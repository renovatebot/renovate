import { basicEnvVars } from '../../lib/util/exec/env.ts';
import { readFile, updateFile } from '../utils/index.ts';
import { replaceContent } from './utils.ts';

function basicEnvVarsToMarkdown(): string {
  const list = [...basicEnvVars]
    // case-insensitive sort
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((v) => ` - \`${v}\``)
    .join('\n');
  return `${list}\n\n`;
}

export async function generateEnvVars(dist: string): Promise<void> {
  let content = await readFile('docs/usage/environment-variable-handling.md');
  content = replaceContent(
    content,
    basicEnvVarsToMarkdown(),
    '<!-- Autogenerate basicEnvVars -->',
  );
  await updateFile(`${dist}/environment-variable-handling.md`, content);
}
