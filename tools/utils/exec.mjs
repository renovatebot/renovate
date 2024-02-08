import { spawnSync } from 'node:child_process';

const maxBuffer = 20 * 1024 * 1024;

/**
 * Execute a command
 * @param {string} cmd
 * @param {string[]} args
 */
export function exec(cmd, args = []) {
  // args from shelljs
  return spawnSync(cmd, args, { maxBuffer, encoding: 'utf8' });
}
