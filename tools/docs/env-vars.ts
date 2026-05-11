import { basicEnvVars } from '../../lib/util/exec/env.ts';
import { readFile, updateFile } from '../utils/index.ts';
import { replaceContent } from './utils.ts';

export async function generateEnvVars(dist: string): Promise<void> {
  const list = basicEnvVars
    // case-insensitive sort
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((v) => ` - \`${v}\``)
    .join('\n');
  const txt = `${list}\n\n`;

  let content = await readFile('docs/usage/environment-variable-handling.md');
  content = replaceContent(content, txt, '<!-- Autogenerate basicEnvVars -->');
  await updateFile(`${dist}/environment-variable-handling.md`, content);
}
