import is from '@sindresorhus/is';
import stringify from 'json-stringify-pretty-compact';
import { getConfigFileNames } from '../../lib/config/app-strings.ts';
import { getEnvName } from '../../lib/config/options/env.ts';
import { getOptions } from '../../lib/config/options/index.ts';
import {
  allManagersList,
  getManagers,
} from '../../lib/modules/manager/index.ts';
import { getToolConfig } from '../../lib/util/exec/containerbase.ts';
import type { ConstraintDefinition } from '../../lib/util/exec/types.ts';
import {
  additionalConstraintDefinitions,
  toolDefinitions,
  toolNames,
} from '../../lib/util/exec/types.ts';
import { getCliName } from '../../lib/workers/global/config/parse/cli.ts';
import { readFile, updateFile } from '../utils/index.ts';
import { formatCell, replaceContent } from './utils.ts';

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
  for (const [rowIndex, row] of data.entries()) {
    if (rowIndex === 0) {
      table += indent`${1}<thead>\n`;
    }

    if (rowIndex === 1) {
      table += indent`${1}</thead>\n` + indent`${1}<tbody>\n`;
    }

    table += indent`${2}<tr>\n`;
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const col = row[colIndex];

      if (rowIndex === 0) {
        // header row
        table += indent`${3}<th>${col}</th>\n`;
        continue;
      }

      const cellHtml = formatCell(row, colIndex);

      table +=
        indent`${3}${cellHtml}` +
        (`${col}`.endsWith('\n') ? indent`${3}` : '') +
        `\n`;
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
    'deprecationMsg',
    'patternMatch',
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
      if (
        // objects and arrays should be printed in JSON notation
        ((type === 'object' || type === 'array') &&
          (el[0] === 'default' || el[0] === 'additionalProperties')) ||
        // enum values for `allowedValues` should be printed in JSON notation
        el[0] === 'allowedValues'
      ) {
        // only show array and object defaults if they are not null and are not empty
        if (Object.keys(el[1] ?? []).length === 0) {
          return;
        }
        el[1] = `\n\`\`\`json\n${stringify(el[1], { indent: 2 })}\n\`\`\`\n`;
      }
      data.push(el);
    }
  });

  if (data.find((k) => k[0] === 'default') === undefined) {
    if (type === 'array') {
      data.push(['default', '<code>[]</code>']);
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
  }

  return buildHtmlTable(data);
}

function stringifyArrays(el: Record<string, any>): void {
  const ignoredKeys = ['allowedValues', 'default', 'experimentalIssues'];

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

function genDeprecationMsg(el: Record<string, any>): string {
  let warning =
    '\n<!-- prettier-ignore -->\n!!! warning "This feature has been deprecated"\n';

  if (el.deprecationMsg) {
    warning += indent`${2}${el.deprecationMsg}`;
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
      optionName = line.split(' ')[1].replace(/^`|`$/g, '');
    }
  }
  indexed[optionName] = [start, lines.length - 1];

  return indexed;
}

function generateLockFileTable(): string {
  const allManagers = getManagers();
  const rows: { name: string; lockFiles: string[] }[] = [];

  for (const [name, definition] of allManagers) {
    if (
      definition.supportsLockFileMaintenance &&
      definition.lockFileNames?.length
    ) {
      rows.push({ name, lockFiles: definition.lockFileNames });
    }
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  let table = '\n| Manager | Lockfile |\n';
  table += '| :-- | :-- |\n';
  for (const row of rows) {
    const lockFiles = row.lockFiles.map((f) => `\`${f}\``).join(', ');
    table += `| \`${row.name}\` | ${lockFiles} |\n`;
  }

  return table;
}

function generateConfigFileNames(): string {
  // TODO #10682 #10651 make sure that we include `getConfigFileNames(platformId)`
  const filenames = getConfigFileNames();

  const all = Array.from(new Set(filenames))
    // remove `package.json`, as we'll write a custom line item for it
    .filter((v) => v !== 'package.json');

  let output = '';
  for (const f of all) {
    output += `1. \`${f}\`\n`;
  }

  output += '1. `package.json` _(within a `"renovate"` section)_\n';

  return output.trimEnd();
}

function generateToolsForConstraints(): string {
  let output = '| Tool | Additional Information | Versioning | Datasource |\n';
  output += '| --- | --- | --- | --- |\n';
  for (const toolDef of toolDefinitions) {
    const toolConfig = getToolConfig(toolDef.name);
    if (!toolConfig) {
      continue;
    }
    const def: ConstraintDefinition = toolDef;
    // Newlines in the Markdown-rendered table will break table rendering
    const desc = def.description?.replaceAll('\n', '<br>') ?? '';
    output += `| \`${toolDef.name}\` | ${desc} | [${toolConfig.versioning}](./modules/versioning/${toolConfig.versioning}/index.md) | [${toolConfig.datasource}](./modules/datasource/${toolConfig.datasource}/index.md) |\n`;
  }

  return output;
}

function generateAdditionalConstraints(): string {
  let output = '| Constraint | Additional Information |\n';
  output += '| --- | --- |\n';
  for (const {
    name,
    description,
  } of additionalConstraintDefinitions as readonly ConstraintDefinition[]) {
    // Newlines in the Markdown-rendered table will break table rendering
    const desc = description?.replaceAll('\n', '<br>') ?? '';
    output += `| \`${name}\` | ${desc} |\n`;
  }

  return output;
}

function generateToolsForInstallTools(): string {
  let output = '';
  for (const tool of [...toolNames]) {
    output += `- \`${tool}\`\n`;
  }

  return output;
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

      // Child options are indexed as "parent.optionName"; collect all matching keys
      let lookupKeys: string[] = [];
      for (const parent of option.parents ?? []) {
        if (parent !== '.') {
          const key = `${parent}.${option.name}`;
          if (indexed[key]) {
            lookupKeys.push(key);
          }
        }
      }
      // Fall back to plain name for top-level ## options (e.g. enabled, managerFilePatterns)
      if (lookupKeys.length === 0) {
        if (!indexed[option.name]) {
          throw new Error(
            `Config option "${option.name}" is missing an entry in ${configFile}`,
          );
        }
        lookupKeys = [option.name];
      }

      el.cli = getCliName(option);
      el.env = getEnvName(option);
      stringifyArrays(el);

      for (const key of lookupKeys) {
        const [headerIndex, footerIndex] = indexed[key];

        configOptionsRaw[headerIndex] +=
          `\n${option.description}\n\n` +
          genTable(Object.entries(el), option.type, option.default);

        if (el.advancedUse) {
          configOptionsRaw[headerIndex] += generateAdvancedUse();
        }

        if (el.experimental) {
          configOptionsRaw[footerIndex] += genExperimentalMsg(el);
        }

        if (is.nonEmptyString(el.deprecationMsg)) {
          configOptionsRaw[footerIndex] += genDeprecationMsg(el);
        }
      }
    });

  let content = configOptionsRaw.join('\n');

  if (!bot) {
    content = replaceContent(content, generateLockFileTable(), {
      replaceStart: '<!-- lock-file-maintenance-table-start -->',
      replaceStop: '<!-- lock-file-maintenance-table-end -->',
    });
  }

  if (!bot) {
    content = replaceContent(content, generateConfigFileNames(), {
      replaceStart: '<!-- config-filenames-begin -->',
      replaceStop: '<!-- config-filenames-end -->',
    });
  }

  if (!bot) {
    content = replaceContent(content, generateToolsForConstraints(), {
      replaceStart: '<!-- constraints-tools-begin -->',
      replaceStop: '<!-- constraints-tools-end -->',
    });
  }

  if (!bot) {
    content = replaceContent(content, generateAdditionalConstraints(), {
      replaceStart: '<!-- additional-constraints-begin -->',
      replaceStop: '<!-- additional-constraints-end -->',
    });
  }

  if (!bot) {
    content = replaceContent(content, generateToolsForInstallTools(), {
      replaceStart: '<!-- installTools-tools-begin -->',
      replaceStop: '<!-- installTools-tools-end -->',
    });
  }

  await updateFile(`${dist}/${configFile}`, content);
}

function generateAdvancedUse(): string {
  return (
    '\n<!-- prettier-ignore -->\n!!! warning\n' +
    '    For advanced use only! Use at your own risk!\n'
  );
}
