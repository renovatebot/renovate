// Code copied from https://github.com/hadfieldn/node-bunyan-prettystream and heavily edited
// Neither fork nor original repo appear to be maintained

const Stream = require('stream').Stream;
const util = require('util');

const format = util.format;

const colors = {
  bold: [1, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  white: [37, 39],
  grey: [90, 39],
  black: [30, 39],
  blue: [34, 39],
  cyan: [36, 39],
  green: [32, 39],
  magenta: [35, 39],
  red: [31, 39],
  yellow: [33, 39],
};

const levelFromName = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const colorFromLevel = {
  10: 'grey', // TRACE
  20: 'blue', // DEBUG
  30: 'green', // INFO
  40: 'magenta', // WARN
  50: 'red', // ERROR
  60: 'inverse', // FATAL
};

const upperPaddedNameFromLevel = {};

Object.keys(levelFromName).forEach(name => {
  const lvl = levelFromName[name];
  upperPaddedNameFromLevel[lvl] =
    (name.length === 4 ? ' ' : '') + name.toUpperCase();
});

function PrettyStream() {
  const self = this;

  this.readable = true;
  this.writable = true;
  this.isTTY = false;

  Stream.call(this);

  function stylize(str, inputColor) {
    if (!str) {
      return '';
    }
    let color = inputColor;

    if (!self.isTTY) {
      return str;
    }

    if (!color) {
      color = 'white';
    }

    const codes = colors[color];
    if (codes) {
      return `\x1B[${codes[0]}m${str}\x1B[${codes[1]}m`;
    }
    return str;
  }

  function indent(s) {
    return `    ${s.split(/\r?\n/).join('\n    ')}`;
  }

  function extractLevel(rec) {
    const level = upperPaddedNameFromLevel[rec.level] || `LVL${rec.level}`;
    return stylize(level, colorFromLevel[rec.level]);
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

    extras = stylize(extras.length ? ` (${extras.join(', ')})` : '');
    details = stylize(details.length ? `${details.join('\n    --\n')}\n` : '');

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

// Track if we're piping into a TTY.
PrettyStream.prototype.pipe = function pipe(dest, options) {
  this.isTTY = dest.isTTY;
  return Stream.prototype.pipe.call(this, dest, options);
};

module.exports = PrettyStream;
