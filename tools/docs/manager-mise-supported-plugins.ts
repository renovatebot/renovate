import {
  asdfTooling,
  miseTooling,
} from '../../lib/modules/manager/mise/upgradeable-tooling.ts';
import { readFile, updateFile } from '../utils/index.ts';
import { replaceContent } from './utils.ts';

function generateCombinedTooling(): string {
  let content = `
  | Name | Source |
  | ---- | ------ |
  `;

  const allTools = [
    ...Object.entries(miseTooling).map(([name, { misePluginUrl }]) => ({
      name,
      url: misePluginUrl,
      source: 'mise',
    })),
    ...Object.entries(asdfTooling).map(([name, { asdfPluginUrl }]) => ({
      name,
      url: asdfPluginUrl,
      source: 'asdf',
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  for (const { name, url, source } of allTools) {
    content += `| [\`${name}\`](${url}) | ${source} |\n`;
  }

  return content;
}

export async function generateManagerMiseSupportedPlugins(
  dist: string,
): Promise<void> {
  const indexFileName = `${dist}/modules/manager/mise/index.md`;
  let indexContent = await readFile(indexFileName);
  // Combine the output of both mise and asdf tooling generation
  const combinedTooling = generateCombinedTooling();
  indexContent = replaceContent(indexContent, combinedTooling);
  await updateFile(indexFileName, indexContent);
}
