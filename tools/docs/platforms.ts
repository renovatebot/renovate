import { getPlatformList } from '../../lib/modules/platform';
import { readFile, updateFile } from '../utils';
import { OpenItems, generateFeatureAndBugMarkdown } from './github-query-items';
import { getModuleLink, replaceContent } from './utils';

export async function generatePlatforms(
  dist: string,
  platformIssuesMap: OpenItems,
): Promise<void> {
  let platformContent = 'Supported values for `platform` are: ';
  const platforms = getPlatformList();
  for (const platform of platforms) {
    let md = await readFile(`lib/modules/platform/${platform}/readme.md`);

    md += generateFeatureAndBugMarkdown(platformIssuesMap, platform);

    await updateFile(`${dist}/modules/platform/${platform}/index.md`, md);
  }

  platformContent += platforms
    .map((v) => getModuleLink(v, `\`${v}\``))
    .join(', ');

  platformContent += '.\n';

  let indexContent = await readFile(`docs/usage/modules/platform/index.md`);
  indexContent = replaceContent(indexContent, platformContent);
  await updateFile(`${dist}/modules/platform/index.md`, indexContent);
}
