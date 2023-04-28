import { execSync } from 'node:child_process';

const maxBuffer = 20 * 1024 * 1024;

/**
 * Execute a command
 * @param {string} cmd
 * @returns {string}
 */
export function exec(cmd) {
  // args from shelljs
  return execSync(cmd, { maxBuffer, stdio: [0, 1, 2] }).toString('utf-8');
}
