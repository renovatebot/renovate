// Code derived from https://github.com/hadfieldn/node-bunyan-RenovateStream and heavily edited
// Neither fork nor original repo appear to be maintained

const Stream = require('stream').Stream;
const util = require('util');
const chalk = require('chalk');

const levels = {
  10: chalk.gray('TRACE'),
  20: chalk.blue('DEBUG'),
  30: chalk.green(' INFO'),
  40: chalk.magenta(' WARN'),
  50: chalk.red('ERROR'),
  60: chalk.bgRed('FATAL'),
};

function RenovateStream() {
  this.readable = true;
  this.writable = true;
  Stream.call(this);

  this.formatRecord = function formatRecord(rec) {
    const level = levels[rec.level];
    const msg = `${rec.msg.split(/\r?\n/).join('\n       ')}`;
    return util.format('%s: %s\n', level, msg);
  };
}

util.inherits(RenovateStream, Stream);

RenovateStream.prototype.write = function write(data) {
  this.emit('data', this.formatRecord(data));
  return true;
};

module.exports = RenovateStream;
