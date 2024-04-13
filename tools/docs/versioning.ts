import { codeBlock } from 'common-tags';
import { getVersioningList } from '../../lib/modules/versioning';
import { readFile, updateFile } from '../utils';
import {
  type OpenItems,
  generateFeatureAndBugMarkdown,
} from './github-query-items';
import {
  formatDescription,
  formatUrls,
  getModuleLink,
  replaceContent,
} from './utils';

type Versioning = {
  id: string;
  displayName: string;
  urls?: string[];
  supportsRanges?: boolean;
  supportedRangeStrategies?: string[];
};

export async function generateVersioning(
  dist: string,
  versioningIssuesMap: OpenItems,
): Promise<void> {
  const versioningList = getVersioningList();
  let versioningContent = '\nSupported values for `versioning` are:\n\n';
  for (const versioning of versioningList) {
    const definition = (await import(
      `../../lib/modules/versioning/${versioning}`
    )) as Versioning;
    const { id, displayName, urls, supportsRanges, supportedRangeStrategies } =
      definition;
    versioningContent += `* ${getModuleLink(
      versioning,
      `\`${versioning}\``,
    )}\n`;
    let md = codeBlock`
    ---
    title: ${displayName}
    edit_url: https://github.com/renovatebot/renovate/edit/main/lib/modules/versioning/${versioning}/readme.md
    ---

    # ${displayName} Versioning
    `;
    md += '\n\n';
    md += `**Identifier**: \`${id}\`\n\n`;
    md += formatUrls(urls);
    md += `**Ranges/Constraints:**\n\n`;
    if (supportsRanges) {
      md += `✅ Ranges are supported.\n\nValid \`rangeStrategy\` values are: ${(
        supportedRangeStrategies ?? []
      )
        .map((strategy: string) => `\`${strategy}\``)
        .join(', ')}\n\n`;
    } else {
      md += `❌ No range support.\n\n`;
    }
    md += await formatDescription('versioning', versioning);
    md += `\n----\n\n`;
    md += generateFeatureAndBugMarkdown(versioningIssuesMap, versioning);

    await updateFile(`${dist}/modules/versioning/${versioning}/index.md`, md);
  }

  let indexContent = await readFile(`docs/usage/modules/versioning/index.md`);
  indexContent = replaceContent(indexContent, versioningContent);
  await updateFile(`${dist}/modules/versioning/index.md`, indexContent);
}
