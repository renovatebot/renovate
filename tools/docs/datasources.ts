import { codeBlock } from 'common-tags';
import { getDatasources } from '../../lib/modules/datasource';
import { readFile, updateFile } from '../utils';
import type { OpenItems } from './github-query-items';
import { generateFeatureAndBugMarkdown } from './github-query-items';
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
      releaseTimestampSupport,
      releaseTimestampNote,
      sourceUrlSupport,
      sourceUrlNote,
    } = definition;
    const displayName = getDisplayName(datasource, definition);
    datasourceContent += `* ${getModuleLink(
      datasource,
      `\`${datasource}\``,
    )}\n`;
    let md = codeBlock`
      ---
      title: ${displayName}
      edit_url: https://github.com/renovatebot/renovate/edit/main/lib/modules/datasource/${datasource}/readme.md
      ---

      # ${displayName} Datasource
      `;
    md += '\n\n';

    let tableContent = '## Table of values\n\n';

    tableContent += '| Name | Value | Notes |\n';
    tableContent += '| :-- | :-- | :-- |\n';

    tableContent += `| Identifier | \`${id}\` | \n`;
    if (defaultVersioning) {
      tableContent += `| Default versioning | \`${defaultVersioning}\` | \n`;
    } else {
      tableContent += `| Default versioning | No default versioning | \n`;
    }

    tableContent += `| Custom registry support | ${customRegistrySupport ? 'Yes' : 'No'} | \n`;
    tableContent += `| Release timestamp support | ${releaseTimestampSupport ? 'Yes' : 'No'} | ${releaseTimestampNote ?? ''} |\n`;
    tableContent += `| Source URL support | ${sourceUrlSupport === 'none' ? 'No' : 'Yes'} | ${sourceUrlNote ?? ''} |\n`;

    md += tableContent + '\n';
    md += formatUrls(urls);
    md += await formatDescription('datasource', datasource);

    if (defaultConfig) {
      md +=
        '## Default configuration\n\n```json\n' +
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
