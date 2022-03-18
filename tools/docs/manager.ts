import type { RenovateConfig } from '../../lib/config/types';
import { getManagers } from '../../lib/modules/manager';
import { readFile, updateFile } from '../utils';
import { getDisplayName, getNameWithUrl, replaceContent } from './utils';

function getTitle(manager: string, displayName: string): string {
  if (manager === 'regex') {
    return `Custom Manager Support using Regex`;
  }
  return `Automated Dependency Updates for ${displayName}`;
}

function getManagerLink(manager: string): string {
  return `[\`${manager}\`](${manager}/)`;
}

export async function generateManagers(dist: string): Promise<void> {
  const managers = getManagers();
  const allLanguages: Record<string, string[]> = {};
  for (const [manager, definition] of managers) {
    const language = definition.language ?? 'other';
    allLanguages[language] = allLanguages[language] || [];
    allLanguages[language].push(manager);
    const { defaultConfig, supportedDatasources } = definition;
    const { fileMatch } = defaultConfig as RenovateConfig;
    const displayName = getDisplayName(manager, definition);
    let md = `---
title: ${getTitle(manager, displayName)}
sidebar_label: ${displayName}
---
`;
    if (manager !== 'regex') {
      const nameWithUrl = getNameWithUrl(manager, definition);
      md += `Renovate supports updating ${nameWithUrl} dependencies.\n\n`;
      if (defaultConfig.enabled === false) {
        md += '## Enabling\n\n';
        md += `${displayName} functionality is currently in beta testing so you must opt in to test it out. To enable it, add a configuration like this to either your bot config or your \`renovate.json\`:\n\n`;
        md += '```\n';
        md += `{\n  "${manager}": {\n    "enabled": true\n  }\n}`;
        md += '\n```\n\n';
        md +=
          'If you find any bugs, please [raise a bug report](https://github.com/renovatebot/renovate/issues/new?template=3-Bug_report.md). If you find that it works well, then feedback on that would be welcome too.\n\n';
      }
      md += '## File Matching\n\n';
      if (!Array.isArray(fileMatch) || fileMatch.length === 0) {
        md += `Because file names for \`${manager}\` cannot be easily determined automatically, Renovate will not attempt to match any \`${manager}\` files by default. `;
      } else {
        md += `By default, Renovate will check any files matching `;
        if (fileMatch.length === 1) {
          md += `the following regular expression: \`${fileMatch[0]}\`.\n\n`;
        } else {
          md += `any of the following regular expressions:\n\n`;
          md += '```\n';
          md += fileMatch.join('\n');
          md += '\n```\n\n';
        }
      }
      md += `For details on how to extend a manager's \`fileMatch\` value, please follow [this link](/modules/manager/#file-matching).\n\n`;
      md += '## Supported datasources\n\n';
      const escapedDatasources = (supportedDatasources || [])
        .map(
          (datasource) =>
            `[\`${datasource}\`](../../datasource/#${datasource}-datasource)`
        )
        .join(', ');
      md += `This manager supports extracting the following datasources: ${escapedDatasources}.\n\n`;
    }
    const managerReadmeContent = await readFile(
      `lib/modules/manager/${manager}/readme.md`
    );
    if (manager !== 'regex') {
      md += '\n## Additional Information\n\n';
    }
    md += managerReadmeContent + '\n\n';

    await updateFile(`${dist}/modules/manager/${manager}/index.md`, md);
  }
  const languages = Object.keys(allLanguages).filter(
    (language) => language !== 'other'
  );
  languages.sort();
  languages.push('other');
  let languageText = '\n';

  for (const language of languages) {
    languageText += `**${language}**: `;
    languageText += allLanguages[language].map(getManagerLink).join(', ');
    languageText += '\n\n';
  }
  let indexContent = await readFile(`docs/usage/modules/manager.md`);
  indexContent = replaceContent(indexContent, languageText);
  await updateFile(`${dist}/modules/manager.md`, indexContent);
}
