import { readFile, updateFile } from '../utils/index.ts';
import { generateCacheNamespacesList } from './config.ts';
import { replaceContent } from './utils.ts';

export async function generateCaching(dist: string): Promise<void> {
  let templateContent = await readFile('docs/usage/caching.md');

  templateContent = replaceContent(
    templateContent,
    generateCacheNamespacesList(),
    '<!-- Autogenerate cache-namespaces -->',
  );

  await updateFile(`${dist}/caching.md`, templateContent);
}
