import { groups as presetGroups } from '../../lib/config/presets/internal';
import { logger } from '../../lib/logger';
import { updateFile } from '../utils';

function jsUcfirst(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function getEditUrl(name: string): string {
  const url =
    'https://github.com/renovatebot/renovate/edit/main/lib/config/presets/internal/';

  switch (name) {
    case 'regexManagers':
      return `${url}regex-managers.ts`;
    case 'mergeConfidence':
      return `${url}merge-confidence.ts`;
    default:
      return `${url}${name}.ts`;
  }
}

/**
 * @param {string} presetTitle
 * @param {number} order
 * @param {string} presetName
 */
function generateFrontMatter(
  presetTitle: string,
  order: number,
  presetName: string,
): string {
  return `---
date: 2017-12-07
title: ${presetTitle} Presets
categories:
    - config-presets
type: Document
order: ${order}
edit_url: ${getEditUrl(presetName)}
---
`;
}

export async function generatePresets(dist: string): Promise<void> {
  let index = 0;
  for (const [name, presetConfig] of Object.entries(presetGroups)) {
    index += 1;
    const formattedName = jsUcfirst(name)
      .replace('Js', 'JS')
      .replace(/s$/, '')
      .replace(/^Config$/, 'Full Config');
    const frontMatter = generateFrontMatter(formattedName, index, name);
    let content = `\n`;
    for (const [preset, value] of Object.entries(presetConfig)) {
      let header = `\n### ${name === 'default' ? '' : name}:${preset}`;
      let presetDescription = value.description as string;
      delete value.description;
      if (!presetDescription) {
        if (value.packageRules?.[0].description) {
          presetDescription = value.packageRules[0].description as string;
          delete value.packageRules[0].description;
        }
      }
      let body = '';
      if (presetDescription) {
        body += `\n\n${presetDescription}\n`;
      } else {
        logger.warn(`Preset ${name}:${preset} has no description`);
      }
      body += '\n```json\n';
      body += JSON.stringify(value, null, 2);
      body += '\n```\n';
      body += '\n----\n';
      if (body.includes('{{arg0}}')) {
        header += '(`<arg0>`';
        if (body.includes('{{arg1}}')) {
          header += ', `<arg1>`';
          if (body.includes('{{arg2}}')) {
            header += ', `<arg2>`';
          }
        }
        header += ')';
        body = body.replace(/{{(arg\d+)}}/g, '$1');
      }
      content += header + body;
    }
    await updateFile(`${dist}/presets-${name}.md`, frontMatter + content);
  }
}
