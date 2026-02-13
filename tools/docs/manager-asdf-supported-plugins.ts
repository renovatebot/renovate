import { upgradeableTooling } from '../../lib/modules/manager/asdf/upgradeable-tooling.ts';
import { readFile, updateFile } from '../utils/index.ts';
import { replaceContent } from './utils.ts';

function generateTooling(): string {
  return Object.entries(upgradeableTooling)
    .map(([name, { asdfPluginUrl }]) => `- [${name}](${asdfPluginUrl})`)
    .join('\n');
}

export async function generateManagerAsdfSupportedPlugins(
  dist: string,
): Promise<void> {
  const indexFileName = `${dist}/modules/manager/asdf/index.md`;
  let indexContent = await readFile(indexFileName);
  indexContent = replaceContent(indexContent, generateTooling());
  await updateFile(`${dist}/modules/manager/asdf/index.md`, indexContent);
}
