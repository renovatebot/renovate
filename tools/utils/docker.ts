import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'os';
import { setTimeout } from 'timers/promises';
import type { SemVer } from 'semver';
import { logger } from '../../lib/logger';
import { toMs } from '../../lib/util/pretty-time';
import { exec } from './exec';

const file = 'tools/docker/bake.hcl';
const tmp = fs.mkdtemp(path.join(os.tmpdir(), 'renovate-docker-bake-'));

export type MetaDataItem = {
  'containerimage.digest'?: string;
};
export type MetaData = {
  'push-slim'?: MetaDataItem;
  'push-full'?: MetaDataItem;
};

export async function bake(
  target: string,
  opts: {
    platform?: string;
    version?: SemVer;
    args?: string[];
    delay?: string;
    exitOnError?: boolean;
    tries?: number;
  },
): Promise<MetaData | null> {
  if (opts.version) {
    console.log(`Using version: ${opts.version.version}`);
    process.env.RENOVATE_VERSION = opts.version.version;
    process.env.RENOVATE_MAJOR_VERSION = `${opts.version.major}`;
    process.env.RENOVATE_MAJOR_MINOR_VERSION = `${opts.version.major}.${opts.version.minor}`;
  }

  const metadataFile = path.join(await tmp, 'metadata.json');
  const args = [
    'buildx',
    'bake',
    '--file',
    file,
    '--metadata-file',
    metadataFile,
  ];

  if (opts.platform) {
    console.log(`Using platform: ${opts.platform}`);
    args.push('--set', `settings.platform=${opts.platform}`);
  }

  if (Array.isArray(opts.args)) {
    console.log(`Using args: ${opts.args.join(' ')}`);
    args.push(...opts.args);
  }

  args.push(target);

  for (let tries = opts.tries ?? 0; tries >= 0; tries--) {
    const result = exec(`docker`, args);
    if (result.signal) {
      logger.error(`Signal received: ${result.signal}`);
      process.exit(-1);
    } else if (result.status && result.status !== 0) {
      if (tries > 0) {
        logger.debug(`Error occured:\n ${result.stderr}`);
        const delay = opts.delay ? toMs(opts.delay) : null;
        if (delay) {
          logger.info(`Retrying in ${opts.delay} ...`);
          await setTimeout(delay);
        }
      } else {
        logger.error(`Error occured:\n${result.stderr}`);
        if (opts.exitOnError !== false) {
          process.exit(result.status);
        }
        return null;
      }
    } else {
      logger.debug(`${target} succeeded:\n${result.stdout || result.stderr}`);
      break;
    }
  }

  const meta = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
  logger.debug({ meta }, 'metadata');

  return meta;
}

export function sign(
  image: string,
  opts: {
    args?: string[];
    exitOnError?: boolean;
  },
): void {
  logger.info(`Signing ${image} ...`);
  const result = exec('cosign', ['sign', '--yes', image]);
  if (result.signal) {
    logger.error(`Signal received: ${result.signal}`);
    process.exit(-1);
  } else if (result.status && result.status !== 0) {
    logger.error(`Error occured:\n${result.stderr}`);
    if (opts.exitOnError !== false) {
      process.exit(result.status);
    }
  } else {
    logger.debug(`Succeeded:\n${result.stdout || result.stderr}`);
  }
}
