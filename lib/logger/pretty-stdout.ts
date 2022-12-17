// Code originally derived from https://github.com/hadfieldn/node-bunyan-prettystream but since heavily edited
// Neither fork nor original repo appear to be maintained

import { Stream } from 'stream';
import * as util from 'util';
import chalk from 'chalk';
import stringify from 'json-stringify-pretty-compact';
import type { BunyanRecord } from './types';

const bunyanFields = [
  'name',
  'hostname',
  'pid',
  'level',
  'v',
  'time',
  'msg',
  'start_time',
];
const metaFields = [
  'repository',
  'baseBranch',
  'packageFile',
  'depType',
  'dependency',
  'dependencies',
  'branch',
];

const levels: Record<number, string> = {
  10: chalk.gray('TRACE'),
  20: chalk.blue('DEBUG'),
  30: chalk.green(' INFO'),
  40: chalk.magenta(' WARN'),
  50: chalk.red('ERROR'),
  60: chalk.bgRed('FATAL'),
};

export function indent(str: string, leading = false): string {
  const prefix = leading ? '       ' : '';
  return prefix + str.split(/\r?\n/).join('\n       '); // TODO #12874
}

export function getMeta(rec: BunyanRecord): string {
  if (!rec) {
    return '';
  }
  let res = rec.module ? ` [${rec.module}]` : ``;
  const filteredMeta = metaFields.filter((elem) => rec[elem]);
  if (!filteredMeta.length) {
    return res;
  }
  const metaStr = filteredMeta
    .map((field) => `${field}=${String(rec[field])}`)
    .join(', ');
  res = ` (${metaStr})${res}`;
  return chalk.gray(res);
}

export function getDetails(rec: BunyanRecord): string {
  if (!rec) {
    return '';
  }
  const recFiltered = { ...rec };
  delete recFiltered.module;
  Object.keys(recFiltered).forEach((key) => {
    if (
      key === 'logContext' ||
      bunyanFields.includes(key) ||
      metaFields.includes(key)
    ) {
      delete recFiltered[key];
    }
  });
  const remainingKeys = Object.keys(recFiltered);
  if (remainingKeys.length === 0) {
    return '';
  }
  return `${remainingKeys
    .map((key) => `${indent(`"${key}": ${stringify(recFiltered[key])}`, true)}`)
    .join(',\n')}\n`;
}

export function formatRecord(rec: BunyanRecord): string {
  const level = levels[rec.level];
  const msg = `${indent(rec.msg)}`;
  const meta = getMeta(rec);
  const details = getDetails(rec);
  return util.format('%s: %s%s\n%s', level, msg, meta, details);
}

export class RenovateStream extends Stream {
  readable: boolean;

  writable: boolean;

  constructor() {
    super();
    this.readable = true;
    this.writable = true;
  }

  // istanbul ignore next
  write(data: BunyanRecord): boolean {
    this.emit('data', formatRecord(data));
    return true;
  }
}
