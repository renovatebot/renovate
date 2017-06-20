// Code copied from https://github.com/hadfieldn/node-bunyan-prettystream and heavily edited
// Neither fork nor original repo appear to be maintained

const Stream = require('stream').Stream;
const util = require('util');
const chalk = require('chalk');

const format = util.format;

const levelNames = {
  10: 'TRACE',
  20: 'DEBUG',
  30: ' INFO',
  40: ' WARN',
  50: 'ERROR',
  60: 'FATAL',
};

const colors = {
  10: chalk.gray, // TRACE
  20: chalk.blue, // DEBUG
  30: chalk.green, // INFO
  40: chalk.magenta, // WARN
  50: chalk.red, // ERROR
  60: chalk.bgRed, // FATAL
};

function PrettyStream() {
  this.readable = true;
  this.writable = true;
  Stream.call(this);

  this.formatRecord = function formatRecord(rec) {
    const levelName = levelNames[rec.level] || `LVL${rec.level}`;
    const level = colors[rec.level](levelName);
    const msg = `${rec.msg.split(/\r?\n/).join('\n       ')}`;
    return format('%s: %s\n', level, msg);
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
