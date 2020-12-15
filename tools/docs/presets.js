import { groups as presetGroups } from '../../dist/config/presets/internal/index.js';
import { updateFile } from '../utils/index.js';

/**
 * @param {string} string
 */
function jsUcfirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * @param {string} name
 * @param {number} order
 */
function generateFrontMatter(name, order) {
  return `---
title: ${name} Presets
categories:
    - config-presets
order: ${order}
---
`;
}

export async function generatePresets() {
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
      let presetDescription = value.description;
      delete value.description;
      if (!presetDescription) {
        if (value.packageRules?.[0].description) {
          presetDescription = value.packageRules[0].description;
          delete value.packageRules[0].description;
        }
      }
      let body = '';
      if (presetDescription) {
        body += `\n\n${presetDescription}\n`;
      } else {
        console.warn(`Preset ${name}:${preset} has no description`);
      }
      body += '\n```\n';
      body += JSON.stringify(value, null, 2);
      body += '\n```\n';
      body += '----\n';
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
    await updateFile(`./docs/presets-${name}.md`, frontMatter + content);
  }
}
