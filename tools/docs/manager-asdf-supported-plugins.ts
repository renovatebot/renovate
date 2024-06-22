import { upgradeableTooling } from '../../lib/modules/manager/asdf/upgradeable-tooling';
import { readFile, updateFile } from '../utils';
import { replaceContent } from './utils';

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
