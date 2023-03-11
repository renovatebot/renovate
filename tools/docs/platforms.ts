import { logger } from '../../lib/logger';
import { getPlatformList, getPlatforms } from '../../lib/modules/platform';
import * as hostRules from '../../lib/util/host-rules';
import { readFile, updateFile } from '../utils';
import { OpenItems, generateFeatureAndBugMarkdown } from './github-query-items';
import { getModuleLink, replaceContent } from './utils';

if (process.env.GITHUB_TOKEN) {
  logger.debug('Using GITHUB_TOKEN from env');
  hostRules.add({
    matchHost: 'api.github.com',
    token: process.env.GITHUB_TOKEN,
  });
}

export async function generatePlatforms(
  dist: string,
  platformIssuesMap: Record<string, OpenItems>
): Promise<void> {
  let platformContent = 'Supported values for `platform` are: ';
  const platforms = getPlatformList();
  for (const platform of platforms) {
    const readme = await readFile(`lib/modules/platform/${platform}/index.md`);
    await updateFile(`${dist}/modules/platform/${platform}/index.md`, readme);
  }

  platformContent += platforms
    .map((v) => getModuleLink(v, `\`${v}\``))
    .join(', ');

  platformContent += '.\n';

  const indexFileName = `docs/usage/modules/platform/index.md`;
  let indexContent = await readFile(indexFileName);
  indexContent = replaceContent(indexContent, platformContent);
  await updateFile(`${dist}/modules/platform/index.md`, indexContent);

  await generatePlatformOpenFeaturesAndBugs(dist, platformIssuesMap);
}

export async function generatePlatformOpenFeaturesAndBugs(
  dist: string,
  platformIssuesMap: Record<string, OpenItems>
): Promise<void> {
  const platforms = getPlatforms();

  for (const [platform] of platforms) {
    const platformReadmeContent = await readFile(
      `lib/modules/platform/${platform}/index.md`
    );

    let md = platformReadmeContent + '\n\n';

    md += generateFeatureAndBugMarkdown(platformIssuesMap, platform);

    await updateFile(`${dist}/modules/platform/${platform}/index.md`, md);
  }
}
