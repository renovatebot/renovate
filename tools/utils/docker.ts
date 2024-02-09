import { setTimeout } from 'timers/promises';
import { logger } from '../../lib/logger';
import { toMs } from '../../lib/util/pretty-time';
import { exec } from './exec';

const file = 'tools/docker/bake.hcl';

export async function bake(
  target: string,
  opts: {
    platform?: string;
    version?: string;
    args?: string[];
    delay?: string;
    exitOnError?: boolean;
  },
  tries: number = 0,
): Promise<void> {
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
  if (result.signal) {
    logger.error(`Signal received: ${result.signal}`);
    process.exit(1);
  } else if (result.status && result.status !== 0) {
    if (tries > 0) {
      logger.debug(`Error occured:\n ${result.stderr}`);
      const delay = opts.delay ? toMs(opts.delay) : null;
      if (delay) {
        logger.info(`Retrying in ${opts.delay} ...`);
        await setTimeout(delay);
      }
      return bake(target, opts, tries - 1);
    } else {
      logger.error(`Error occured:\n${result.stderr}`);
      if (opts.exitOnError !== false) {
        process.exit(result.status);
      }
    }
  } else {
    logger.debug(`${target} succeeded:\n${result.stdout || result.stderr}`);
  }
}
