import { getDatasources } from '../../lib/datasource';
import { readFile, updateFile } from '../utils';
import {
  formatDescription,
  formatUrls,
  getDisplayName,
  replaceContent,
} from './utils';

export async function generateDatasources(dist: string): Promise<void> {
  const dsList = getDatasources();
  let datasourceContent =
    '\nSupported values for `datasource` are: ' +
    [...dsList.keys()].map((v) => `\`${v}\``).join(', ') +
    '.\n\n';
  for (const [datasource, definition] of dsList) {
    const { id, urls, defaultConfig } = definition;
    const displayName = getDisplayName(datasource, definition);
    datasourceContent += `\n### ${displayName} Datasource\n\n`;
    datasourceContent += `**Identifier**: \`${id}\`\n\n`;
    datasourceContent += formatUrls(urls);
    datasourceContent += await formatDescription('datasource', datasource);

    if (defaultConfig) {
      datasourceContent +=
        '**Default configuration**:\n\n```json\n' +
        JSON.stringify(defaultConfig, undefined, 2) +
        '\n```\n';
    }

    datasourceContent += `\n----\n\n`;
  }
  let indexContent = await readFile(`docs/usage/modules/datasource.md`);
  indexContent = replaceContent(indexContent, datasourceContent);
  await updateFile(`${dist}/modules/datasource.md`, indexContent);
}
