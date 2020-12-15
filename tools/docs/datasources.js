import { readFile, updateFile } from '../utils/index.js';
import {
  formatDescription,
  formatUrls,
  getDisplayName,
  replaceContent,
} from './utils.js';

export async function generateDatasources() {
  const dsIndex = await import(`../../dist/datasource/index.js`);
  const dsList = dsIndex.getDatasourceList();
  let datasourceContent =
    '\nSupported values for `datasource` are: ' +
    dsList.map((v) => `\`${v}\``).join(', ') +
    '.\n\n';
  for (const datasource of dsList) {
    const definition = await import(
      `../../dist/datasource/${datasource}/index.js`
    );
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
  let indexContent = await readFile(`../usage/modules/datasource.md`);
  indexContent = replaceContent(indexContent, datasourceContent);
  await updateFile(`./docs/modules/datasource.md`, indexContent);
}
