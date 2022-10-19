import { groups as presetGroups } from '../../lib/config/presets/internal';
import { logger } from '../../lib/logger';
import { updateFile } from '../utils';

function jsUcfirst(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * @param {string} name
 * @param {number} order
 */
function generateFrontMatter(name: string, order: number): string {
  return `---
date: 2017-12-07
title: ${name} Presets
categories:
    - config-presets
type: Document
order: ${order}
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
    const frontMatter = generateFrontMatter(formattedName, index);
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
