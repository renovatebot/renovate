import stringify from 'json-stringify-pretty-compact';
import { getOptions } from '../../lib/config/options';
import { allManagersList } from '../../lib/modules/manager';
import { getCliName } from '../../lib/workers/global/config/parse/cli';
import { getEnvName } from '../../lib/workers/global/config/parse/env';
import { readFile, updateFile } from '../utils';

const options = getOptions();
const managers = new Set(allManagersList);

/**
 * Merge string arrays one by one
 * Example: let arr1 = ['a','b','c'], arr2 = ['1','2','3','4','5']
 * merge(arr1,arr2) = ['a','1','b','2','c','3','4','5']
 * @param array1
 * @param array2
 */
function merge(array1: string[], array2: string[]): string[] {
  const arr1 = [...array1];
  const arr2 = [...array2];
  const merged: string[] = [];

  for (const str1 of arr1) {
    merged.push(str1);
    const str2 = arr2.pop();
    if (str2 !== undefined) {
      merged.push(str2);
    }
  }
  return merged.concat(arr2);
}

function indent(
  strings: TemplateStringsArray,
  ...keys: (string | number | boolean)[]
): string {
  const indent = '  ';
  const strs = [...strings];
  let amount = 0;
  // validate input
  if (typeof keys[0] === 'number' && strings[0] === '') {
    amount = keys.shift() as number;
    strs.shift();
  }
  return indent.repeat(amount) + merge(strs, keys.map(String)).join('');
}

function buildHtmlTable(data: string[][]): string {
  // skip empty tables
  if (data.length < 2) {
    return '';
  }
  let table = `<table>\n`;
  for (const [i, row] of data.entries()) {
    if (i === 0) {
      table += indent`${1}<thead>\n`;
    }

    if (i === 1) {
      table += indent`${1}</thead>\n` + indent`${1}<tbody>\n`;
    }

    table += indent`${2}<tr>\n`;
    for (const col of row) {
      if (i === 0) {
        table += indent`${3}<th>${col}</th>\n`;
        continue;
      }
      table +=
        indent`${3}<td>${col}` +
        (`${col}`.endsWith('\n') ? indent`${3}` : '') +
        `</td>\n`;
    }
    table += indent`${2}</tr>\n`;
  }
  table += indent`${1}</tbody>\n</table>\n`;
  return table;
}

function genTable(obj: [string, string][], type: string, def: any): string {
  const data = [['Name', 'Value']];
  const name = obj[0][1];
  const ignoredKeys = [
    'name',
    'description',
    'default',
    'stage',
    'allowString',
    'admin',
    'globalOnly',
    'experimental',
    'experimentalDescription',
    'experimentalIssues',
    'advancedUse',
  ];
  obj.forEach(([key, val]) => {
    const el = [key, val];
    if (key === 'cli' && !val) {
      ignoredKeys.push('cli');
    }
    if (key === 'env' && !val) {
      ignoredKeys.push('env');
    }
    if (
      !ignoredKeys.includes(el[0]) ||
      (el[0] === 'default' &&
        (typeof el[1] !== 'object' || ['array', 'object'].includes(type)) &&
        name !== 'prBody')
    ) {
      if (type === 'string' && el[0] === 'default') {
        el[1] = `<code>"${el[1]}"</code>`;
      }
      if (
        (type === 'boolean' && el[0] === 'default') ||
        el[0] === 'cli' ||
        el[0] === 'env'
      ) {
        el[1] = `<code>${el[1]}</code>`;
      }
      // objects and arrays should be printed in JSON notation
      if ((type === 'object' || type === 'array') && el[0] === 'default') {
        // only show array and object defaults if they are not null and are not empty
        if (Object.keys(el[1] ?? []).length === 0) {
          return;
        }
        el[1] = `\n\`\`\`json\n${stringify(el[1], { indent: 2 })}\n\`\`\`\n`;
      }
      data.push(el);
    }
  });

  if (type === 'list') {
    data.push(['default', '`[]`']);
  }
  if (type === 'string' && def === undefined) {
    data.push(['default', '<code>null</code>']);
  }
  if (type === 'boolean' && def === undefined) {
    data.push(['default', '<code>true</code>']);
  }
  if (type === 'boolean' && def === null) {
    data.push(['default', '<code>null</code>']);
  }
  return buildHtmlTable(data);
}

function stringifyArrays(el: Record<string, any>): void {
  const ignoredKeys = ['default', 'experimentalIssues'];

  for (const [key, value] of Object.entries(el)) {
    if (!ignoredKeys.includes(key) && Array.isArray(value)) {
      el[key] = value.join(', ');
    }
  }
}

function genExperimentalMsg(el: Record<string, any>): string {
  const ghIssuesUrl = 'https://github.com/renovatebot/renovate/issues/';
  let warning =
    '\n<!-- prettier-ignore -->\n!!! warning "This feature is flagged as experimental"\n';

  if (el.experimentalDescription) {
    warning += indent`${2}${el.experimentalDescription}`;
  } else {
    warning += indent`${2}Experimental features might be changed or even removed at any time.`;
  }

  const issues = el.experimentalIssues ?? [];
  if (issues.length > 0) {
    warning += `<br>To track this feature visit the following GitHub ${
      issues.length > 1 ? 'issues' : 'issue'
    } `;
    warning +=
      (issues
        .map((issue: number) => `[#${issue}](${ghIssuesUrl}${issue})`)
        .join(', ') as string) + '.';
  }

  return warning + '\n';
}

function indexMarkdown(lines: string[]): Record<string, [number, number]> {
  const indexed: Record<string, [number, number]> = {};

  let optionName = '';
  let start = 0;
  for (const [i, line] of lines.entries()) {
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (optionName) {
        indexed[optionName] = [start, i - 1];
      }
      start = i;
      optionName = line.split(' ')[1];
    }
  }
  indexed[optionName] = [start, lines.length - 1];

  return indexed;
}

export async function generateConfig(dist: string, bot = false): Promise<void> {
  let configFile = `configuration-options.md`;
  if (bot) {
    configFile = `self-hosted-configuration.md`;
  }

  const configOptionsRaw = (await readFile(`docs/usage/${configFile}`)).split(
    '\n',
  );

  const indexed = indexMarkdown(configOptionsRaw);

  options
    .filter(
      (option) => !!option.globalOnly === bot && !managers.has(option.name),
    )
    .forEach((option) => {
      // TODO: fix types (#22198,#9610)
      const el: Record<string, any> = { ...option };

      if (!indexed[option.name]) {
        throw new Error(
          `Config option "${option.name}" is missing an entry in ${configFile}`,
        );
      }

      const [headerIndex, footerIndex] = indexed[option.name];

      el.cli = getCliName(option);
      el.env = getEnvName(option);
      stringifyArrays(el);

      configOptionsRaw[headerIndex] +=
        `\n${option.description}\n\n` +
        genTable(Object.entries(el), option.type, option.default);

      if (el.advancedUse) {
        configOptionsRaw[headerIndex] += generateAdvancedUse();
      }

      if (el.experimental) {
        configOptionsRaw[footerIndex] += genExperimentalMsg(el);
      }
    });

  await updateFile(`${dist}/${configFile}`, configOptionsRaw.join('\n'));
}

function generateAdvancedUse(): string {
  return (
    '\n<!-- prettier-ignore -->\n!!! warning\n' +
    '    For advanced use only! Use at your own risk!\n'
  );
}
