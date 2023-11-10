import { codeBlock } from 'common-tags';
import { getDatasources } from '../../lib/modules/datasource';
import { readFile, updateFile } from '../utils';
import { OpenItems, generateFeatureAndBugMarkdown } from './github-query-items';
import {
  formatDescription,
  formatUrls,
  getDisplayName,
  getModuleLink,
  replaceContent,
} from './utils';

export async function generateDatasources(
  dist: string,
  datasourceIssuesMap: OpenItems,
): Promise<void> {
  const dsList = getDatasources();
  let datasourceContent = '\nSupported values for `datasource` are:\n\n';

  for (const [datasource, definition] of dsList) {
    const {
      id,
      urls,
      defaultConfig,
      customRegistrySupport,
      defaultVersioning,
    } = definition;
    const displayName = getDisplayName(datasource, definition);
    datasourceContent += `* ${getModuleLink(
      datasource,
      `\`${datasource}\``,
    )}\n`;
    let md = codeBlock`
      ---
      title: ${displayName}
      ---

      # ${displayName} Datasource
      `;
    md += '\n\n';
    md += `**Identifier**: \`${id}\`\n\n`;
    if (defaultVersioning) {
      md += `**Default versioning**: \`${defaultVersioning}\`\n\n`;
    } else {
      md += `**Default versioning**: no default versioning\n\n`;
    }
    md += formatUrls(urls);
    md += `**Custom registry support**: \n\n`;
    if (customRegistrySupport) {
      md += `✅ Custom registries are supported.\n\n`;
    } else {
      md += `❌ No custom registry support.\n\n`;
    }
    md += await formatDescription('datasource', datasource);

    if (defaultConfig) {
      md +=
        '**Default configuration**:\n\n```json\n' +
        JSON.stringify(defaultConfig, undefined, 2) +
        '\n```\n';
    }

    md += generateFeatureAndBugMarkdown(datasourceIssuesMap, datasource);

    await updateFile(`${dist}/modules/datasource/${datasource}/index.md`, md);
  }

  let indexContent = await readFile(`docs/usage/modules/datasource/index.md`);
  indexContent = replaceContent(indexContent, datasourceContent);
  await updateFile(`${dist}/modules/datasource/index.md`, indexContent);
}
