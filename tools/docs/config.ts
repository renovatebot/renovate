import stringify from 'json-stringify-pretty-compact';
import { getOptions } from '../../lib/config/options';
import { getCliName } from '../../lib/workers/global/config/parse/cli';
import { getEnvName } from '../../lib/workers/global/config/parse/env';
import { readFile, updateFile } from '../utils';

const options = getOptions();

function indent(amount: number, indent = '  '): string {
  let indentation = '';
  for (let i = 0; i < amount; i++) {
    indentation += indent;
  }
  return indentation;
}

function buildHtmlTable(data: string[][]): string {
  // skip empty tables
  if (data.length < 2) {
    return '';
  }
  let table = `<table>\n`;
  for (const [i, row] of data.entries()) {
    if (i === 0) {
      table += `${indent(1)}<thead>\n`;
    }

    if (i === 1) {
      table += `${indent(1)}</thead>\n${indent(1)}<tbody>\n`;
    }

    table += `${indent(2)}<tr>\n`;
    for (const col of row) {
      if (i === 0) {
        table += `${indent(3)}<th>${col}</th>\n`;
        continue;
      }
      table += `${indent(3)}<td>${col}</td>\n`;
    }
    table += `${indent(2)}</tr>\n`;
  }
  table += `${indent(1)}</tbody>\n</table>\n`;
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
      if (type === 'string' && el[0] === 'default' && el[1].length > 200) {
        el[1] = `[template]`;
      }
      // objects and arrays should be printed in JSON notation
      if ((type === 'object' || type === 'array') && el[0] === 'default') {
        // only show array and object defaults if they are not null and are not empty
        if (Object.keys(el[1] ?? []).length === 0) {
          return;
        }
        el[1] = `<pre lang="json">${stringify(def, { indent: 2 })}</pre>`;
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

export async function generateConfig(dist: string, bot = false): Promise<void> {
  let configFile = `configuration-options.md`;
  if (bot) {
    configFile = `self-hosted-configuration.md`;
  }

  const configOptionsRaw = (await readFile(`docs/usage/${configFile}`)).split(
    '\n'
  );

  options
    .filter((option) => option.releaseStatus !== 'unpublished')
    .forEach((option) => {
      // TODO: fix types (#9610)
      const el: Record<string, any> = { ...option };
      let headerIndex = configOptionsRaw.indexOf(`## ${option.name}`);
      if (headerIndex === -1) {
        headerIndex = configOptionsRaw.indexOf(`### ${option.name}`);
      }
      el.cli = getCliName(option);
      el.env = getEnvName(option);

      configOptionsRaw[headerIndex] +=
        `\n${option.description}\n\n` +
        genTable(Object.entries(el), option.type, option.default);
    });

  await updateFile(`${dist}/${configFile}`, configOptionsRaw.join('\n'));
}
