import { setTimeout } from 'timers/promises';
import { exec } from './exec.mjs';

const file = 'tools/docker/bake.hcl';

/**
 *
 * @param {string} target
 * @param {{platform?:string, version?: string, args?: string[]}} opts
 * @param {number} tries
 */
export async function bake(target, opts, tries = 0) {
  if (opts.version) {
    console.log(`Using version: ${opts.version}`);
    process.env.RENOVATE_VERSION = opts.version;
  }

  const args = ['buildx', 'bake', '--file', file];

  if (opts.platform) {
    console.log(`Using platform: ${opts.platform}`);
    args.push('--set', `settings.platform=${opts.platform}`);
  }

  if (Array.isArray(opts.args)) {
    console.log(`Using args: ${opts.args.join(' ')}`);
    args.push(...opts.args);
  }

  args.push(target);

  const result = exec(`docker`, args);
  if (result.status !== 0) {
    if (tries > 0) {
      console.log(`Error occured:`, result.stderr || result.stdout);
      console.warn(`Retrying in 30s ...`);
      await setTimeout(30000);
      return bake(target, opts, tries - 1);
    } else {
      throw new Error(result.stderr || result.stdout);
    }
  }
}
