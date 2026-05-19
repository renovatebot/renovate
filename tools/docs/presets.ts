import { groups as presetGroups } from '../../lib/config/presets/internal/index.ts';
import { logger } from '../../lib/logger/index.ts';
import { updateFile } from '../utils/index.ts';

function jsUcfirst(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function presetRefToLink(presetRef: string): string | null {
  // Separate base name from arguments: ":followTag(typescript, next)" -> base=":followTag", argCount=2
  let baseName = presetRef;
  let argCount = 0;
  const parenMatch = /^([^(]+)\((.+)\)$/.exec(presetRef);
  if (parenMatch) {
    baseName = parenMatch[1];
    argCount = parenMatch[2].split(/,\s*/).length;
  }

  let group: string;
  const colonIdx = baseName.indexOf(':');
  if (colonIdx === 0) {
    group = 'default';
  } else if (colonIdx > 0) {
    group = baseName.slice(0, colonIdx);
  } else {
    return null;
  }

  // Reconstruct the heading text as it appears on the target page,
  // where concrete args are replaced with <arg0>, <arg1>, etc.
  let headingText = baseName;
  if (argCount > 0) {
    const argList = Array.from({ length: argCount }, (_, i) => `<arg${i}>`);
    headingText += `(${argList.join(', ')})`;
  }

  // Slugify matching python-markdown's toc extension default behavior
  const slug = headingText
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '-');

  return `./presets-${group}.md#${slug}`;
}

function getPresetDescription(
  presetRef: string,
  descriptions: Map<string, string>,
): string | undefined {
  // Try exact match first
  let desc = descriptions.get(presetRef);
  if (desc) {
    return desc;
  }

  // Parameterized preset references like ":semanticCommitType(chore)" will be looked up as `:semanticCommitType` (which is the preset name)
  const [prefix] = presetRef.split('(');
  if (prefix) {
    desc = descriptions.get(prefix);
    if (desc) {
      return desc;
    }
  }

  return undefined;
}

function generateCodeBlock(
  value: Record<string, unknown>,
  descriptions: Map<string, string>,
): string {
  const json = JSON.stringify(value, null, 2);
  const lines = json.split('\n');
  let inExtends = false;
  let counter = 0;
  const annotations: {
    num: number;
    ref: string;
    link: string;
    description: string | undefined;
  }[] = [];

  const annotatedLines = lines.map((line) => {
    if (/^\s+"extends":\s*\[/.test(line)) {
      inExtends = true;
      return line;
    }
    if (inExtends) {
      if (/^\s+\]/.test(line)) {
        inExtends = false;
        return line;
      }
      const match = /^(\s+"([^"]+)")(,?)$/.exec(line);
      if (match) {
        const presetRef = match[2];
        const link = presetRefToLink(presetRef);
        if (link) {
          counter++;
          const description = getPresetDescription(presetRef, descriptions);
          annotations.push({ num: counter, ref: presetRef, link, description });
          // note that we use a trailing `!` to strip the comment from the resulting code block
          return `${match[1]}${match[3]} // (${counter})!`;
        }
      }
    }
    return line;
  });

  if (annotations.length === 0) {
    return `\n\`\`\`json\n${json}\n\`\`\`\n`;
  }

  let result = '\n``` { .json .annotate }\n';
  result += annotatedLines.join('\n');
  result += '\n```\n\n';

  for (const ann of annotations) {
    if (ann.description) {
      result += `${ann.num}. [\`${ann.ref}\`](${ann.link}): ${ann.description}\n`;
    } else {
      result += `${ann.num}. [\`${ann.ref}\`](${ann.link})\n`;
    }
  }

  return result;
}

function getEditUrl(name: string): string {
  const url =
    'https://github.com/renovatebot/renovate/edit/main/lib/config/presets/internal/';
  const dataUrl = 'https://github.com/renovatebot/renovate/edit/main/lib/data/';
  switch (name) {
    case 'customManagers':
      return `${url}custom-managers.ts`;
    case 'mergeConfidence':
      return `${url}merge-confidence.ts`;
    case 'monorepo':
      return `${dataUrl}${name}.json`;
    case 'replacements':
      return `${dataUrl}${name}.json`;
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
  // Calculate the descriptions for each preset ahead-of-time, as we remove them during generation
  const descriptions = new Map<string, string>();
  for (const [groupName, presetConfig] of Object.entries(presetGroups)) {
    for (const [presetName, value] of Object.entries(presetConfig)) {
      const ref =
        groupName === 'default'
          ? `:${presetName}`
          : `${groupName}:${presetName}`;
      const desc =
        (value.description as string | undefined) ??
        (value.packageRules?.[0]?.description as string | undefined);
      if (desc) {
        descriptions.set(ref, desc);
      }
    }
  }

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
        logger.warn(
          { preset: `${name}:${preset}` },
          'Preset has no description',
        );
      }
      body += generateCodeBlock(value, descriptions);
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
