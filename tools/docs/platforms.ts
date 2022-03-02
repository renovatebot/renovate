import { getPlatformList } from '../../lib/modules/platform';
import { readFile, updateFile } from '../utils';
import { replaceContent } from './utils';

function getModuleLink(module: string, title: string): string {
  return `[${title ?? module}](${module}/)`;
}

export async function generatePlatforms(dist: string): Promise<void> {
  let platformContent = 'Supported values for `platform` are: ';
  const platforms = getPlatformList();
  for (const platform of platforms) {
    const readme = await readFile(`lib/platform/${platform}/index.md`);
    await updateFile(`${dist}/modules/platform/${platform}/index.md`, readme);
  }

  platformContent += platforms
    .map((v) => getModuleLink(v, `\`${v}\``))
    .join(', ');

  platformContent += '.\n';

  const indexFileName = `docs/usage/modules/platform.md`;
  let indexContent = await readFile(indexFileName);
  indexContent = replaceContent(indexContent, platformContent);
  await updateFile(`${dist}/modules/platform.md`, indexContent);
}
