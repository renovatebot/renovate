import {
  asdfTooling,
  miseTooling,
} from '../../lib/modules/manager/mise/upgradeable-tooling';
import { readFile, updateFile } from '../utils';
import { replaceContent } from './utils';

function generateMiseTooling(): string {
  return Object.entries(miseTooling)
    .map(([name, { misePluginUrl }]) => `- [${name} (mise)](${misePluginUrl})`)
    .join('\n');
}

function generateAsdfTooling(): string {
  return Object.entries(asdfTooling)
    .map(([name, { asdfPluginUrl }]) => `- [${name} (asdf)](${asdfPluginUrl})`)
    .join('\n');
}

export async function generateManagerMiseSupportedPlugins(
  dist: string,
): Promise<void> {
  const indexFileName = `${dist}/modules/manager/mise/index.md`;
  let indexContent = await readFile(indexFileName);
  // Combine the output of both mise and asdf tooling generation
  const combinedTooling = `${generateMiseTooling()}\n${generateAsdfTooling()}`;
  indexContent = replaceContent(indexContent, combinedTooling);
  await updateFile(indexFileName, indexContent);
}
