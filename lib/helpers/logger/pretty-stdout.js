// Code derived from https://github.com/hadfieldn/node-bunyan-RenovateStream and heavily edited
// Neither fork nor original repo appear to be maintained

const Stream = require('stream').Stream;
const util = require('util');
const chalk = require('chalk');
const stringify = require('json-stringify-pretty-compact');

const levels = {
  10: chalk.gray('TRACE'),
  20: chalk.blue('DEBUG'),
  30: chalk.green(' INFO'),
  40: chalk.magenta(' WARN'),
  50: chalk.red('ERROR'),
  60: chalk.bgRed('FATAL'),
};

function indent(str, leading = false) {
  const prefix = leading ? '       ' : '';
  return prefix + str.split(/\r?\n/).join('\n       ');
}

function getMeta(rec) {
  if (!rec) {
    return '';
  }
  const metaFields = [
    'repository',
    'packageFile',
    'depType',
    'dependency',
    'branch',
  ].filter(elem => rec[elem]);
  if (!metaFields.length) {
    return '';
  }
  const metaStr = metaFields.map(field => `${field}=${rec[field]}`).join(', ');
  return chalk.gray(` (${metaStr})`);
}

function getDetails(rec) {
  if (!rec || !rec.config) {
    return '';
  }
  return `${indent(stringify(rec.config), true)}\n`;
}

function formatRecord(rec) {
  const level = levels[rec.level];
  const msg = `${indent(rec.msg)}`;
  const meta = getMeta(rec);
  const details = getDetails(rec);
  return util.format('%s: %s%s\n%s', level, msg, meta, details);
}

function RenovateStream() {
  this.readable = true;
  this.writable = true;
  Stream.call(this);
}

util.inherits(RenovateStream, Stream);

RenovateStream.prototype.write = function write(data) {
  this.emit('data', formatRecord(data));
  return true;
};

module.exports = {
  indent,
  getMeta,
  getDetails,
  formatRecord,
  RenovateStream,
};
