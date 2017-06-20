// Code copied from https://github.com/hadfieldn/node-bunyan-prettystream and heavily edited
// Neither fork nor original repo appear to be maintained

const Stream = require('stream').Stream;
const util = require('util');
const chalk = require('chalk');

const format = util.format;

const levelFromName = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const colors = {
  10: chalk.gray, // TRACE
  20: chalk.blue, // DEBUG
  30: chalk.green, // INFO
  40: chalk.magenta, // WARN
  50: chalk.red, // ERROR
  60: chalk.bgRed, // FATAL
};

const upperPaddedNameFromLevel = {};

Object.keys(levelFromName).forEach(name => {
  const lvl = levelFromName[name];
  upperPaddedNameFromLevel[lvl] =
    (name.length === 4 ? ' ' : '') + name.toUpperCase();
});

function PrettyStream() {
  this.readable = true;
  this.writable = true;
  Stream.call(this);

  function indent(s) {
    return `    ${s.split(/\r?\n/).join('\n    ')}`;
  }

  function extractLevel(rec) {
    const level = upperPaddedNameFromLevel[rec.level] || `LVL${rec.level}`;
    return colors[rec.level](level);
  }

  function isSingleLineMsg(rec) {
    return rec.msg.indexOf('\n') === -1;
  }

  function extractMsg(rec) {
    return rec.msg;
  }

  function extractError(rec) {
    if (rec.err && rec.err.stack) {
      return rec.err.stack;
    }
    return null;
  }

  function extractCustomDetails(rec) {
    const skip = [
      'name',
      'hostname',
      'pid',
      'level',
      'component',
      'msg',
      'time',
      'v',
      'src',
      'err',
      'client_req',
      'client_res',
      'req',
      'res',
    ];

    const details = [];
    const extras = {};

    Object.keys(rec).forEach(key => {
      if (skip.indexOf(key) === -1) {
        let value = rec[key];
        if (typeof value === 'undefined') value = '';
        let stringified = false;
        if (typeof value === 'function') {
          value = '[Function]';
          stringified = true;
        } else if (typeof value !== 'string') {
          value = JSON.stringify(value, null, 2);
          stringified = true;
        }
        if (value.indexOf('\n') !== -1 || value.length > 50) {
          details.push(`${key}: ${value}`);
        } else if (
          !stringified &&
          (value.indexOf(' ') !== -1 || value.length === 0)
        ) {
          extras[key] = JSON.stringify(value);
        } else {
          extras[key] = value;
        }
      }
    });

    return {
      details,
      extras,
    };
  }

  function applyDetails(results, details, extras) {
    if (results) {
      results.details.forEach(d => {
        details.push(indent(d));
      });
      Object.keys(results.extras).forEach(k => {
        extras.push(`${k}=${results.extras[k]}`);
      });
    }
  }

  this.formatRecord = function formatRecord(rec) {
    let details = [];
    let extras = [];

    const level = extractLevel(rec);

    const msg = isSingleLineMsg(rec) ? extractMsg(rec) : '';
    if (!msg) {
      details.push(indent(extractMsg(rec)));
    }

    const error = extractError(rec);
    if (error) {
      details.push(indent(error));
    }

    applyDetails(extractCustomDetails(rec), details, extras);

    extras = extras.length ? ` (${extras.join(', ')})` : '';
    details = details.length ? `${details.join('\n    --\n')}\n` : '';

    return format('%s: %s%s\n%s', level, msg, extras, details);
  };
}

util.inherits(PrettyStream, Stream);

PrettyStream.prototype.write = function write(data) {
  if (typeof data === 'string') {
    this.emit('data', this.formatRecord(JSON.parse(data)));
  } else if (typeof data === 'object') {
    this.emit('data', this.formatRecord(data));
  }
  return true;
};

PrettyStream.prototype.end = function end() {
  this.emit('end');
  return true;
};

module.exports = PrettyStream;
