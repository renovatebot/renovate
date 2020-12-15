import table from 'markdown-table';
import { getCliName } from '../../dist/config/cli.js';
import { getOptions } from '../../dist/config/definitions.js';
import { getEnvName } from '../../dist/config/env.js';
import { readFile, updateFile } from '../utils/index.js';

const options = getOptions();

/**
 * @param {[string,any][]} obj
 * @param {string} type
 * @param {any} def
 */
function genTable(obj, type, def) {
  const data = [['Name', 'Value']];
  const name = obj[0][1];
  const ignoredKeys = [
    'name',
    'description',
    'default',
    'stage',
    'allowString',
    'cli',
    'env',
    'admin',
  ];
  obj.forEach(([key, val]) => {
    const el = [key, val];
    if (
      !ignoredKeys.includes(el[0]) ||
      (el[0] === 'default' && typeof el[1] !== 'object' && name !== 'prBody')
    ) {
      if (type === 'string' && el[0] === 'default') {
        el[1] = `\`"${el[1]}"\``;
      }
      if (type === 'boolean' && el[0] === 'default') {
        el[1] = `\`${el[1]}\``;
      }
      if (type === 'string' && el[0] === 'default' && el[1].length > 200) {
        el[1] = `[template]`;
      }
      data.push(el);
    }
  });

  if (type === 'list') {
    data.push(['default', '`[]`']);
  }
  if (type === 'string' && def === undefined) {
    data.push(['default', '`null`']);
  }
  if (type === 'boolean' && def === undefined) {
    data.push(['default', '`true`']);
  }
  if (type === 'boolean' && def === null) {
    data.push(['default', '`null`']);
  }
  return table(data);
}

export async function generateConfig(bot = false) {
  let configFile = `configuration-options.md`;
  if (bot) {
    configFile = `self-hosted-configuration.md`;
  }

  const configOptionsRaw = (await readFile(`../usage/${configFile}`)).split(
    '\n'
  );

  options
    .filter((option) => option.releaseStatus !== 'unpublished')
    .forEach((option) => {
      /** @type {Record<string,any>} */
      const el = { ...option };
      let headerIndex = configOptionsRaw.indexOf(`## ${el.name}`);
      if (headerIndex === -1) {
        headerIndex = configOptionsRaw.indexOf(`### ${el.name}`);
      }
      if (bot) {
        el.cli = getCliName(el);
        el.env = getEnvName(el);
        if (el.cli === '') {
          el.cli = `N/A`;
        }
        if (el.env === '') {
          el.env = 'N/A';
        }
      }

      configOptionsRaw[headerIndex] +=
        `\n${el.description}\n\n` +
        genTable(Object.entries(el), el.type, el.default);
    });

  await updateFile(`./docs/${configFile}`, configOptionsRaw.join('\n'));
}
