import { readFile, updateFile } from '../utils/index.js';
import { getDisplayName, getNameWithUrl, replaceContent } from './utils.js';

/**
 * @param {string} manager
 * @param {string} displayName
 */
function getTitle(manager, displayName) {
  if (manager === 'regex') {
    return `Custom Manager Support using Regex`;
  }
  return `Automated Dependency Updates for ${displayName}`;
}

export async function generateManagers() {
  const managerIndex = await import('../../dist/manager/index.js');
  const managers = managerIndex.getManagers();
  const allLanguages = {};
  for (const [manager, definition] of managers) {
    const language = definition.language || 'other';
    allLanguages[language] = allLanguages[language] || [];
    allLanguages[language].push(manager);
    const { defaultConfig } = definition;
    const { fileMatch } = defaultConfig;
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
          'If you encounter any bugs, please [raise a bug report](https://github.com/renovatebot/renovate/issues/new?template=3-Bug_report.md). If you find that it works well, then feedback on that would be welcome too.\n\n';
      }
      md += '## File Matching\n\n';
      if (fileMatch.length === 0) {
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
    }

    const managerReadmeFile = `../../lib/manager/${manager}/readme.md`;

    try {
      const managerReadmeContent = await readFile(managerReadmeFile);
      if (manager !== 'regex') {
        md += '\n## Additional Information\n\n';
      }
      md += managerReadmeContent + '\n\n';
    } catch (err) {
      // console.warn('Not found:' + moduleReadmeFile);
    }
    const managerFileName = `./docs/modules/manager/${manager}.md`;
    await updateFile(managerFileName, md);
  }
  const languages = Object.keys(allLanguages).filter(
    (language) => language !== 'other'
  );
  languages.sort();
  languages.push('other');
  let languageText = '\n';
  function getManagerLink(manager) {
    return `[${manager}](./manager/${manager}.md)`;
  }
  for (const language of languages) {
    languageText += `**${language}**: `;
    languageText += allLanguages[language].map(getManagerLink).join(', ');
    languageText += '\n\n';
  }
  const indexFileName = `./docs/modules/manager.md`;
  let indexContent = await readFile(indexFileName);
  indexContent = replaceContent(indexContent, languageText);
  await updateFile(indexFileName, indexContent);
}
